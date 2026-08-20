import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Session, Telemetry } from '@irdashies/types';
import { IncidentProcessor } from './IncidentProcessor';
import { IncidentType } from '../../types/raceControl';
import { TrackLocation, SessionState } from '../irsdk/types/enums';

const raceSession = (overrides: Record<string, unknown> = {}): Session =>
  ({
    WeekendInfo: { TrackLength: '5.000 km' },
    SessionInfo: { Sessions: [{ SessionNum: 0, SessionType: 'Race' }] },
    DriverInfo: {
      Drivers: [
        {
          CarIdx: 0,
          UserName: 'Test',
          CarNumber: '99',
          TeamName: '',
          CarIsPaceCar: 0,
        },
      ],
    },
    ...overrides,
  }) as unknown as Session;

const frame = (overrides: Record<string, unknown> = {}): Telemetry =>
  ({
    SessionTime: { value: [100] },
    SessionNum: { value: [0] },
    SessionState: { value: [SessionState.Racing] },
    ReplayFrameNum: { value: [6000] },
    CarIdxLapDistPct: { value: [0.5] },
    CarIdxLap: { value: [3] },
    CarIdxTrackSurface: { value: [TrackLocation.OnTrack] },
    CarIdxSessionFlags: { value: [0] },
    CarIdxOnPitRoad: { value: [false] },
    ...overrides,
  }) as unknown as Telemetry;

// Frame step for the pit-entry helpers. These run on the shipped defaults, so
// three consecutive frames must span more than pitEntryDurationSeconds (0.6s)
// while two must not.
const PIT_STEP = 0.4;

/** Drives a pit entry: one off-pit frame, then three on-pit frames. */
const pitEntryAt = (
  processor: IncidentProcessor,
  startTime: number,
  extra: Record<string, unknown> = {}
) => {
  processor.onFrame(
    frame({
      CarIdxOnPitRoad: { value: [false] },
      SessionTime: { value: [startTime] },
      ...extra,
    })
  );
  for (let i = 1; i <= 3; i++) {
    processor.onFrame(
      frame({
        CarIdxOnPitRoad: { value: [true] },
        SessionTime: { value: [startTime + i * PIT_STEP] },
        ...extra,
      })
    );
  }
};

describe('IncidentProcessor', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing until track length is known from init()', () => {
    const processor = new IncidentProcessor();
    processor.onFrame(frame({ CarIdxOnPitRoad: { value: [true] } }));
    expect(processor.snapshot()).toEqual([]);
  });

  it('emits a PitEntry incident once the car has been on pit road for pitEntryDurationSeconds', () => {
    const processor = new IncidentProcessor();
    processor.init(raceSession());

    processor.onFrame(frame({ CarIdxOnPitRoad: { value: [false] } }));
    expect(processor.snapshot()).toEqual([]);

    for (let i = 0; i < 2; i++) {
      processor.onFrame(
        frame({
          CarIdxOnPitRoad: { value: [true] },
          SessionTime: { value: [100 + (i + 1) * PIT_STEP] },
        })
      );
      expect(processor.snapshot()).toEqual([]);
    }

    processor.onFrame(
      frame({
        CarIdxOnPitRoad: { value: [true] },
        SessionTime: { value: [100 + 3 * PIT_STEP] },
      })
    );

    const emitted = processor.snapshot();
    expect(emitted).toHaveLength(1);
    expect(emitted[0].type).toBe(IncidentType.PitEntry);
  });

  it('snapshot() is pure — repeated calls without an intervening onFrame return the same result', () => {
    const processor = new IncidentProcessor();
    processor.init(raceSession());
    processor.onFrame(frame({ CarIdxOnPitRoad: { value: [false] } }));
    for (let i = 0; i < 3; i++) {
      processor.onFrame(
        frame({
          CarIdxOnPitRoad: { value: [true] },
          SessionTime: { value: [100 + (i + 1) * PIT_STEP] },
        })
      );
    }

    const first = processor.snapshot();
    const second = processor.snapshot();
    expect(second).toBe(first);
    expect(second).toEqual(first);
  });

  it('clears emitted incidents on the next onFrame with no new incident', () => {
    const processor = new IncidentProcessor();
    processor.init(raceSession());
    processor.onFrame(frame({ CarIdxOnPitRoad: { value: [false] } }));
    for (let i = 0; i < 3; i++) {
      processor.onFrame(
        frame({
          CarIdxOnPitRoad: { value: [true] },
          SessionTime: { value: [100 + (i + 1) * PIT_STEP] },
        })
      );
    }
    expect(processor.snapshot()).toHaveLength(1);

    processor.onFrame(
      frame({
        CarIdxOnPitRoad: { value: [true] },
        SessionTime: { value: [100 + 4 * PIT_STEP] },
      })
    );
    expect(processor.snapshot()).toEqual([]);
  });

  it('re-runs updateSession when SessionNum changes mid-stream', () => {
    const processor = new IncidentProcessor();
    const session = raceSession();
    processor.init(session);

    // Seed frame in SessionNum 0.
    processor.onFrame(frame({ SessionNum: { value: [0] } }));

    // A car state was building up off-track frames in SessionNum 0.
    processor.onFrame(
      frame({
        SessionNum: { value: [0] },
        CarIdxTrackSurface: { value: [TrackLocation.OffTrack] },
      })
    );

    // SessionNum changes (e.g. Qualifying -> Race) — detector state resets,
    // so the off-track counter above must not carry over.
    processor.onFrame(
      frame({
        SessionNum: { value: [1] },
        CarIdxTrackSurface: { value: [TrackLocation.OffTrack] },
        SessionTime: { value: [200] },
      })
    );
    processor.onFrame(
      frame({
        SessionNum: { value: [1] },
        CarIdxTrackSurface: { value: [TrackLocation.OffTrack] },
        SessionTime: { value: [200.04] },
      })
    );

    // Only 0.04s off track since the reset — below the default
    // offTrackDurationSeconds, so nothing should have fired yet.
    expect(processor.snapshot()).toEqual([]);
  });

  it('resets retained state on disconnect', () => {
    const processor = new IncidentProcessor();
    processor.init(raceSession());
    processor.onFrame(frame({ CarIdxOnPitRoad: { value: [false] } }));

    processor.onLifecycle({ type: 'disconnect' });

    // Track length is now unknown again, so onFrame should no-op.
    processor.onFrame(frame({ CarIdxOnPitRoad: { value: [true] } }));
    expect(processor.snapshot()).toEqual([]);
  });

  describe('replay review and spectating', () => {
    it('still detects while spectating, when IsReplayPlaying is set', () => {
      // Spectating a session without a car of your own reports as replay
      // playing for the whole race. Detection must not be disabled by it.
      const processor = new IncidentProcessor();
      processor.init(raceSession());

      pitEntryAt(processor, 100, { IsReplayPlaying: { value: [true] } });

      expect(processor.snapshot()).toHaveLength(1);
    });

    it('does not re-detect frames replayed from earlier in the session', () => {
      const processor = new IncidentProcessor();
      processor.init(raceSession());

      pitEntryAt(processor, 300);
      expect(processor.snapshot()).toHaveLength(1);

      // Operator rewinds to review it. These session times are behind the
      // high-water mark, so they must not produce a second incident.
      pitEntryAt(processor, 100);
      expect(processor.snapshot()).toEqual([]);
    });

    it('resumes detecting once playback passes the point already covered', () => {
      const processor = new IncidentProcessor();
      processor.init(raceSession());

      processor.onFrame(frame({ SessionTime: { value: [100] } }));
      // Rewind.
      processor.onFrame(frame({ SessionTime: { value: [50] } }));
      expect(processor.snapshot()).toEqual([]);

      // Past the high-water mark again: a fresh pit entry is real.
      pitEntryAt(processor, 200);
      expect(processor.snapshot()).toHaveLength(1);
    });

    it('re-seeds after a rewind so stale state cannot fire', () => {
      const processor = new IncidentProcessor();
      processor.init(raceSession());

      // Two off-track frames live — one short of the debounce of 3.
      for (let i = 0; i < 2; i++) {
        processor.onFrame(
          frame({
            CarIdxTrackSurface: { value: [TrackLocation.OffTrack] },
            SessionTime: { value: [100 + i * 0.04] },
          })
        );
      }
      expect(processor.snapshot()).toEqual([]);

      // Rewind, then resume beyond the mark. The counter restarted, so this
      // must not complete the pre-rewind debounce.
      processor.onFrame(frame({ SessionTime: { value: [50] } }));
      processor.onFrame(
        frame({
          CarIdxTrackSurface: { value: [TrackLocation.OffTrack] },
          SessionTime: { value: [200] },
        })
      );
      expect(processor.snapshot()).toEqual([]);
    });

    it('does not treat a session change as a rewind', () => {
      const processor = new IncidentProcessor();
      processor.init(raceSession());

      pitEntryAt(processor, 900);
      expect(processor.snapshot()).toHaveLength(1);

      // New session: time restarts near zero but detection must continue.
      pitEntryAt(processor, 10, { SessionNum: { value: [1] } });
      expect(processor.snapshot()).toHaveLength(1);
    });
  });

  describe('debug snapshot', () => {
    it('carries the debug snapshot so the evidence can be copied', () => {
      const processor = new IncidentProcessor();
      processor.init(raceSession());

      pitEntryAt(processor, 100);

      const [incident] = processor.snapshot();
      expect(incident.debug).toBeDefined();
      expect(incident.debug?.evidence).toBeTruthy();
      expect(incident.debug?.thresholds).toBeDefined();
    });
  });

  describe('sustained conditions report once', () => {
    it('reports a car parked on pit road only once', () => {
      const processor = new IncidentProcessor();
      processor.init(raceSession());

      processor.onFrame(
        frame({
          CarIdxOnPitRoad: { value: [false] },
          SessionTime: { value: [100] },
        })
      );

      // Sit in the box well beyond the 5s cooldown.
      let emitted = 0;
      for (let i = 1; i <= 400; i++) {
        processor.onFrame(
          frame({
            CarIdxOnPitRoad: { value: [true] },
            SessionTime: { value: [100 + i * 0.05] },
          })
        );
        emitted += processor.snapshot().length;
      }

      expect(emitted).toBe(1);
    });

    it('reports a car beached off track only once', () => {
      const processor = new IncidentProcessor();
      processor.init(raceSession());

      // The car has to arrive under power. Detection is not gated on session
      // type or state any more; what separates a beached car from a parked one
      // is that it was moving beforehand, so a fixture that starts stationary
      // is correctly reported as nothing at all.
      let emitted = 0;
      let t = 100;
      let pct = 0.5;
      const feed = (kmh: number) => {
        t += 0.05;
        pct += ((kmh / 3.6) * 0.05) / 5000;
        processor.onFrame(
          frame({
            CarIdxTrackSurface: { value: [TrackLocation.OffTrack] },
            CarIdxLapDistPct: { value: [pct] },
            SessionTime: { value: [t] },
          })
        );
        emitted += processor.snapshot().length;
      };

      // Slides off at speed, coasts to a halt, then sits for 20s.
      for (let i = 0; i < 30; i++) feed(100);
      for (let v = 100; v > 0; v -= 2) feed(v);
      for (let i = 0; i < 400; i++) feed(0);

      expect(emitted).toBe(1);
    });

    it('does not report a car that was already in the pits when seeding', () => {
      // Exiting and re-entering your own car re-seeds the detector. A car that
      // was parked in its box throughout must not look like a fresh entry.
      const processor = new IncidentProcessor();
      processor.init(raceSession());

      let emitted = 0;
      for (let i = 0; i < 20; i++) {
        processor.onFrame(
          frame({
            CarIdxOnPitRoad: { value: [true] },
            SessionTime: { value: [100 + i * 0.05] },
          })
        );
        emitted += processor.snapshot().length;
      }

      expect(emitted).toBe(0);
    });

    it('reports again after the car leaves and re-enters the pits', () => {
      const processor = new IncidentProcessor();
      processor.init(raceSession());

      pitEntryAt(processor, 100);
      expect(processor.snapshot()).toHaveLength(1);

      // Leave pit road, which re-arms the latch.
      processor.onFrame(
        frame({
          CarIdxOnPitRoad: { value: [false] },
          SessionTime: { value: [200] },
        })
      );
      pitEntryAt(processor, 300);
      expect(processor.snapshot()).toHaveLength(1);
    });
  });

  it('clears car state when entering a session', () => {
    const processor = new IncidentProcessor();
    processor.init(raceSession());

    for (let i = 0; i < 2; i++) {
      processor.onFrame(
        frame({
          CarIdxTrackSurface: { value: [TrackLocation.OffTrack] },
          SessionTime: { value: [100 + i * 0.04] },
        })
      );
    }

    processor.onLifecycle({ type: 'enter', replay: false });

    processor.onFrame(
      frame({
        CarIdxTrackSurface: { value: [TrackLocation.OffTrack] },
        SessionTime: { value: [100.08] },
      })
    );
    expect(processor.snapshot()).toEqual([]);
  });
});
