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

describe('IncidentProcessor', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('does nothing until track length is known from init()', () => {
    const processor = new IncidentProcessor();
    processor.onFrame(frame({ CarIdxOnPitRoad: { value: [true] } }));
    expect(processor.snapshot()).toEqual([]);
  });

  it('emits a PitEntry incident after pitEntryDebounce consecutive frames', () => {
    const processor = new IncidentProcessor();
    processor.init(raceSession());

    processor.onFrame(frame({ CarIdxOnPitRoad: { value: [false] } }));
    expect(processor.snapshot()).toEqual([]);

    for (let i = 0; i < 2; i++) {
      processor.onFrame(
        frame({
          CarIdxOnPitRoad: { value: [true] },
          SessionTime: { value: [100.04 + i * 0.04] },
        })
      );
      expect(processor.snapshot()).toEqual([]);
    }

    processor.onFrame(
      frame({
        CarIdxOnPitRoad: { value: [true] },
        SessionTime: { value: [100.12] },
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
          SessionTime: { value: [100.04 + i * 0.04] },
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
          SessionTime: { value: [100.04 + i * 0.04] },
        })
      );
    }
    expect(processor.snapshot()).toHaveLength(1);

    processor.onFrame(
      frame({
        CarIdxOnPitRoad: { value: [true] },
        SessionTime: { value: [100.16] },
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

    // Only 2 consecutive off-track frames since the reset — below the
    // default debounce of 3, so nothing should have fired yet.
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

  describe('in-sim replay', () => {
    /** Drives a pit entry: one off-pit frame, then pitEntryDebounce (3) on-pit. */
    const pitEntryAt = (
      processor: IncidentProcessor,
      startTime: number,
      replaying: boolean
    ) => {
      const replayFlag = replaying
        ? { IsReplayPlaying: { value: [true] } }
        : {};
      processor.onFrame(
        frame({
          CarIdxOnPitRoad: { value: [false] },
          SessionTime: { value: [startTime] },
          ...replayFlag,
        })
      );
      for (let i = 1; i <= 3; i++) {
        processor.onFrame(
          frame({
            CarIdxOnPitRoad: { value: [true] },
            SessionTime: { value: [startTime + i * 0.04] },
            ...replayFlag,
          })
        );
      }
    };

    it('emits nothing while a replay is playing', () => {
      const processor = new IncidentProcessor();
      processor.init(raceSession());

      pitEntryAt(processor, 100, true);

      expect(processor.snapshot()).toEqual([]);
    });

    it('does not re-detect an incident when that part of the race is replayed', () => {
      // The per-type cooldown is wall-clock based (Date.now), not session
      // time, so without advancing the clock it would suppress the second
      // detection on its own and this test would pass even with no gate.
      vi.useFakeTimers();
      const processor = new IncidentProcessor();
      processor.init(raceSession());

      pitEntryAt(processor, 100, false);
      expect(processor.snapshot()).toHaveLength(1);

      // Past the 5s default cooldown, so a replayed re-detection would fire.
      vi.advanceTimersByTime(10_000);

      pitEntryAt(processor, 200, true);
      expect(processor.snapshot()).toEqual([]);
    });

    it('drops stale car state when playback returns to live', () => {
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

      // A replayed off-track frame would otherwise be the third in a row.
      processor.onFrame(
        frame({
          CarIdxTrackSurface: { value: [TrackLocation.OffTrack] },
          IsReplayPlaying: { value: [true] },
          SessionTime: { value: [300] },
        })
      );
      expect(processor.snapshot()).toEqual([]);

      // Back live: the counter restarted, so this must not complete the
      // pre-replay debounce either.
      processor.onFrame(
        frame({
          CarIdxTrackSurface: { value: [TrackLocation.OffTrack] },
          SessionTime: { value: [100.08] },
        })
      );
      expect(processor.snapshot()).toEqual([]);
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
