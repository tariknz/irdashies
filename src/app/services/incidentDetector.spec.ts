import { describe, it, expect, vi } from 'vitest';
import { IncidentDetector } from './incidentDetector';
import type { IncidentThresholds } from '../../types/raceControl';
import { IncidentType } from '../../types/raceControl';
import type { Incident } from '../../types/raceControl';
import { TrackLocation, GlobalFlags, SessionState } from '../irsdk/types/enums';

const defaultThresholds: IncidentThresholds = {
  slowSpeedThreshold: 15,
  slowFrameThreshold: 10,
  suddenStopFromSpeed: 80,
  suddenStopToSpeed: 20,
  suddenStopFrames: 3,
  offTrackDebounce: 3,
  pitEntryDebounce: 3,
  cooldownSeconds: 5,
};

const makeTelemetry = (
  overrides: Partial<{
    sessionTime: number;
    sessionNum: number;
    sessionState: number;
    replayFrameNum: number;
    carIdxLapDistPct: number[];
    carIdxLap: number[];
    carIdxTrackSurface: number[];
    carIdxSessionFlags: number[];
    carIdxOnPitRoad: boolean[];
  }> = {}
) => ({
  sessionTime: 100,
  sessionNum: 0,
  sessionState: SessionState.Racing,
  replayFrameNum: 6000,
  carIdxLapDistPct: [0.5],
  carIdxLap: [3],
  carIdxTrackSurface: [TrackLocation.OnTrack],
  carIdxSessionFlags: [0],
  carIdxOnPitRoad: [false],
  ...overrides,
});

// A one-car Race session. SessionType matters: sustained-slow only reports in
// a race, because stopping is routine in practice and qualifying.
const raceSession = () => ({
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
});

describe('IncidentDetector - speed calculation', () => {
  it('calculates speed from lapDistPct delta and track length', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    // 0.001 pct * 5000m = 5m in 0.04s (25Hz) → 125 m/s → 450 km/h
    const speed = detector.calculateSpeed(0.5, 0.501, 0.04, 5000);
    expect(speed).toBeCloseTo(450, 0);
  });

  it('handles lap wrap-around (lapDistPct 0.99 → 0.01)', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const speed = detector.calculateSpeed(0.99, 0.01, 0.04, 5000);
    // distPct = 0.01 - 0.99 = -0.98, wrap-around: -0.98 + 1.0 = 0.02
    // 0.02 * 5000 = 100m / 0.04s = 2500 m/s * 3.6 = 9000 km/h (fast car at finish)
    expect(speed).toBeGreaterThan(0);
  });

  it('returns null for backwards movement (collision nudge)', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const speed = detector.calculateSpeed(0.5, 0.499, 0.04, 5000);
    expect(speed).toBeNull();
  });

  it('returns null when the position has not refreshed since the last tick', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    // Remote cars' lapDistPct arrives slower than we poll, so an unchanged
    // position is "no reading yet" — not a stationary car.
    expect(detector.calculateSpeed(0.5, 0.5, 0.04, 5000)).toBeNull();
  });

  it('returns null when the session clock has not advanced (paused replay)', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    expect(detector.calculateSpeed(0.5, 0.501, 0, 5000)).toBeNull();
    expect(detector.calculateSpeed(0.5, 0.501, -1, 5000)).toBeNull();
  });
});

describe('session transitions', () => {
  const makeDrivers = () => ({
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
  });

  it('clears car states on first updateSession (initial load)', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (detector as any).carStates.set(0, { slowFrameCount: 5 });
    detector.updateSession({
      WeekendInfo: { SubSessionID: 111 },
      ...makeDrivers(),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((detector as any).carStates.size).toBe(0);
  });

  it('PRESERVES car states when same session YAML is re-published (no change)', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    detector.updateSession(
      { WeekendInfo: { SubSessionID: 111 }, ...makeDrivers() },
      0
    );
    // Seed state via processTelemetry
    detector.processTelemetry(
      makeTelemetry({ carIdxLapDistPct: [0.5], sessionTime: 100 }),
      5000
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stateBefore = (detector as any).carStates.get(0);
    expect(stateBefore).toBeDefined();

    // Session YAML re-published with identical SubSessionID + SessionNum
    detector.updateSession(
      { WeekendInfo: { SubSessionID: 111 }, ...makeDrivers() },
      0
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const stateAfter = (detector as any).carStates.get(0);
    expect(stateAfter).toBe(stateBefore);
    expect(stateAfter.hasPrevFrame).toBe(true);
  });

  it('RESETS car states when SessionNum changes (phase transition Practice → Race)', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    detector.updateSession(
      { WeekendInfo: { SubSessionID: 111 }, ...makeDrivers() },
      0 // Practice
    );
    detector.processTelemetry(
      makeTelemetry({ carIdxLapDistPct: [0.5], sessionTime: 100 }),
      5000
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((detector as any).carStates.size).toBe(1);

    // Phase change within same SubSessionID
    detector.updateSession(
      { WeekendInfo: { SubSessionID: 111 }, ...makeDrivers() },
      2 // Race
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((detector as any).carStates.size).toBe(0);
  });

  it('resets when SessionNum first resolves after the initial YAML update', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const session = { WeekendInfo: { SubSessionID: 111 }, ...makeDrivers() };
    detector.updateSession(session);
    detector.processTelemetry(makeTelemetry(), 5000);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((detector as any).carStates.size).toBe(1);

    detector.updateSession(session, 2);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((detector as any).carStates.size).toBe(0);
  });

  it('RESETS car states when SubSessionID changes', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    detector.updateSession(
      { WeekendInfo: { SubSessionID: 111 }, ...makeDrivers() },
      0
    );
    detector.processTelemetry(
      makeTelemetry({ carIdxLapDistPct: [0.5], sessionTime: 100 }),
      5000
    );
    detector.updateSession(
      { WeekendInfo: { SubSessionID: 222 }, ...makeDrivers() },
      0
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((detector as any).carStates.size).toBe(0);
  });
});

describe('first-frame speed guard', () => {
  it('does not emit sudden-stop crash on the first processed frame', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(
      {
        WeekendInfo: { SubSessionID: 111 },
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
      },
      0
    );

    // Repro of the live bug: prevLapDistPct=0, currLapDistPct=0.5 on a 5km
    // track = 18,000 km/h "speed" on first frame, then real 0 km/h on next
    // tick → previously fired false sudden-stop Crash.
    detector.processTelemetry(
      makeTelemetry({ carIdxLapDistPct: [0.5], sessionTime: 100 }),
      5000
    );
    // Subsequent stationary frames
    for (let i = 1; i < 5; i++) {
      detector.processTelemetry(
        makeTelemetry({ carIdxLapDistPct: [0.5], sessionTime: 100 + i * 0.04 }),
        5000
      );
    }
    expect(incidents.filter((i) => i.type === IncidentType.Crash)).toHaveLength(
      0
    );
  });
});

describe('sudden stop - session changeover', () => {
  it('still fires for a genuine high-speed stop while racing', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // Four frames at ~225 km/h to fill the suddenStopFrames buffer...
    let pct = 0.5;
    for (let i = 0; i < 5; i++) {
      detector.processTelemetry(
        makeTelemetry({
          carIdxLapDistPct: [pct],
          sessionTime: 100 + i * 0.04,
        }),
        5000
      );
      pct += 0.0025;
    }
    // ...then barely moving: a real impact.
    for (let i = 0; i < 3; i++) {
      pct += 0.000005;
      detector.processTelemetry(
        makeTelemetry({
          carIdxLapDistPct: [pct],
          sessionTime: 100.2 + i * 0.04,
        }),
        5000
      );
    }

    expect(incidents.some((i) => i.type === IncidentType.Crash)).toBe(true);
  });

  it('does not fire when cars are gridded after a practice/qualifying to race change', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // Car circulating at speed near the end of the previous session.
    let pct = 0.5;
    for (let i = 0; i < 5; i++) {
      detector.processTelemetry(
        makeTelemetry({
          carIdxLapDistPct: [pct],
          sessionTime: 100 + i * 0.04,
          sessionState: SessionState.Racing,
        }),
        5000
      );
      pct += 0.0025; // ~225 km/h
    }

    // Changeover: iRacing lifts the car off track and sets it on the grid,
    // stationary, while the session sits in a pre-race state.
    for (let i = 0; i < 10; i++) {
      detector.processTelemetry(
        makeTelemetry({
          carIdxLapDistPct: [0.9235 + i * 0.000002], // grid jitter
          sessionTime: 9 + i * 0.04,
          sessionState: SessionState.GetInCar,
        }),
        5000
      );
    }

    expect(incidents.filter((i) => i.type === IncidentType.Crash)).toHaveLength(
      0
    );
  });
});

describe('crash detection - off the racing surface', () => {
  it('fires Crash for a car that comes to rest in the gravel', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, slowFrameThreshold: 3 },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // Runs wide onto the gravel, straddling the edge (surface flickers
    // OnTrack/OffTrack) while scrubbing off speed.
    let pct = 0.806;
    let t = 479;
    const surfaces = [
      TrackLocation.OnTrack,
      TrackLocation.OffTrack,
      TrackLocation.OnTrack,
      TrackLocation.OffTrack,
      TrackLocation.OffTrack,
    ];
    for (const s of surfaces) {
      pct += 0.00005;
      t += 0.05;
      detector.processTelemetry(
        makeTelemetry({
          carIdxLapDistPct: [pct],
          carIdxTrackSurface: [s],
          sessionTime: t,
        }),
        20832
      );
    }
    // Buried in the gravel against the barrier: off track and barely moving.
    // Needs enough frames to flush the ~75 km/h entries out of the 5-sample
    // rolling average before slowFrameCount can start climbing.
    for (let i = 0; i < 12; i++) {
      pct += 0.0000005;
      t += 0.05;
      detector.processTelemetry(
        makeTelemetry({
          carIdxLapDistPct: [pct],
          carIdxTrackSurface: [TrackLocation.OffTrack],
          sessionTime: t,
        }),
        20832
      );
    }

    expect(incidents.some((i) => i.type === IncidentType.Crash)).toBe(true);
  });

  it('does not fire Crash for a car stationary in its pit stall', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, slowFrameThreshold: 3 },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    let pct = 0.1;
    let t = 100;
    for (let i = 0; i < 10; i++) {
      pct += 0.0000005;
      t += 0.05;
      detector.processTelemetry(
        makeTelemetry({
          carIdxLapDistPct: [pct],
          carIdxTrackSurface: [TrackLocation.InPitStall],
          sessionTime: t,
        }),
        20832
      );
    }

    expect(incidents.some((i) => i.type === IncidentType.Crash)).toBe(false);
  });
});

describe('contact detection', () => {
  const twoCars = {
    DriverInfo: {
      Drivers: [
        {
          CarIdx: 0,
          UserName: 'Driver A',
          CarNumber: '15',
          TeamName: '',
          CarIsPaceCar: 0,
        },
        {
          CarIdx: 1,
          UserName: 'Driver B',
          CarNumber: '23',
          TeamName: '',
          CarIsPaceCar: 0,
        },
      ],
    },
  };

  // Puts one car off the road at a given place and time. Surfaces are fed
  // one frame at a time so each car's debounce trips independently.
  //
  // Only safe for negative assertions or a single call: the idle car holds a
  // fixed position, so a second call at a different position makes it appear
  // to jump, which fabricates a speed spike and then a speed loss. Tests that
  // depend on speed should drive both cars continuously instead.
  const runOffTrack = (
    detector: IncidentDetector,
    carIdx: number,
    pct: number,
    startTime: number
  ) => {
    const surfaces = [TrackLocation.OnTrack, TrackLocation.OnTrack];
    const both = [TrackLocation.OnTrack, TrackLocation.OnTrack];
    for (let i = 0; i < 2 + defaultThresholds.offTrackDebounce; i++) {
      const s = i < 2 ? surfaces[i] : TrackLocation.OffTrack;
      const lap = [pct, pct];
      const surf = [...both];
      lap[carIdx] = pct + i * 0.00002;
      surf[carIdx] = s;
      detector.processTelemetry(
        makeTelemetry({
          carIdxLapDistPct: lap,
          carIdxTrackSurface: surf,
          carIdxOnPitRoad: [false, false],
          carIdxSessionFlags: [0, 0],
          sessionTime: startTime + i * 0.05,
        }),
        20832
      );
    }
  };

  it('upgrades an off-track to a Crash when another car is in trouble alongside', () => {
    // isDev so the debug snapshot (and its evidence string) is populated.
    const detector = new IncidentDetector(defaultThresholds, true);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(twoCars);

    // Car A is hit and slows sharply; car B runs on and leaves the road ~2s
    // later, ~25m away — the spacing seen in the logged collision. Positions
    // advance every tick for both so no artificial speed spike is introduced.
    const FAST = 0.0000753; // ~113 km/h on a 20.8km track at 20Hz
    const pct = [0.5655, 0.5653];
    let t = 790;
    for (let i = 0; i < 30; i++) {
      // Car A is hit at tick 10 and loses most of its speed. Car B is
      // unaffected and keeps its pace, leaving the road shortly after.
      pct[0] += i < 10 ? FAST : FAST * 0.15;
      pct[1] += FAST;
      t += 0.05;
      detector.processTelemetry(
        makeTelemetry({
          carIdxLapDistPct: [pct[0], pct[1]],
          carIdxTrackSurface: [
            i >= 12 && i <= 16 ? TrackLocation.OffTrack : TrackLocation.OnTrack,
            i >= 20 && i <= 24 ? TrackLocation.OffTrack : TrackLocation.OnTrack,
          ],
          carIdxOnPitRoad: [false, false],
          carIdxSessionFlags: [0, 0],
          sessionTime: t,
        }),
        20832
      );
    }

    const forB = incidents.filter((i) => i.carIdx === 1);
    expect(forB.some((i) => i.type === IncidentType.Crash)).toBe(true);
    expect(
      forB.find((i) => i.type === IncidentType.Crash)?.debug?.evidence
    ).toContain('#15');
  });

  it('does not pair two cars that run wide at the same corner without losing speed', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(twoCars);

    // Both cars miss the apex at a steady ~113 km/h and carry straight on at
    // unchanged pace — close together and moments apart, but nobody was hit.
    // Positions advance every tick for both cars so no artificial speed spike
    // is introduced.
    const STEP = 0.0000753; // ~113 km/h on a 20.8km track at 20Hz
    const pct = [0.2263, 0.2255];
    let t = 329;
    for (let i = 0; i < 30; i++) {
      pct[0] += STEP;
      pct[1] += STEP;
      t += 0.05;
      detector.processTelemetry(
        makeTelemetry({
          carIdxLapDistPct: [pct[0], pct[1]],
          carIdxTrackSurface: [
            i >= 10 && i <= 14 ? TrackLocation.OffTrack : TrackLocation.OnTrack,
            i >= 18 && i <= 22 ? TrackLocation.OffTrack : TrackLocation.OnTrack,
          ],
          carIdxOnPitRoad: [false, false],
          carIdxSessionFlags: [0, 0],
          sessionTime: t,
        }),
        20832
      );
    }

    expect(incidents.some((i) => i.type === IncidentType.Crash)).toBe(false);
    expect(
      incidents.filter((i) => i.type === IncidentType.OffTrack).length
    ).toBe(2);
  });

  it('leaves a lone off-track as an OffTrack incident', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(twoCars);

    runOffTrack(detector, 0, 0.5655, 790.5);

    expect(incidents.some((i) => i.type === IncidentType.Crash)).toBe(false);
    expect(incidents.some((i) => i.type === IncidentType.OffTrack)).toBe(true);
  });

  it('does not pair cars that go off far apart on track', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(twoCars);

    // Same moment, but opposite sides of the circuit.
    runOffTrack(detector, 0, 0.1, 790.5);
    runOffTrack(detector, 1, 0.6, 790.6);

    expect(incidents.some((i) => i.type === IncidentType.Crash)).toBe(false);
  });

  it('does not pair cars whose incidents are far apart in time', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(twoCars);

    // Same corner, but a lap apart.
    runOffTrack(detector, 0, 0.5655, 790.5);
    runOffTrack(detector, 1, 0.5658, 890.5);

    expect(incidents.some((i) => i.type === IncidentType.Crash)).toBe(false);
  });
});

describe('pit entry detection', () => {
  it('does not emit incidents for spectators', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((incident) => incidents.push(incident));
    detector.updateSession({
      ...raceSession(),
      DriverInfo: {
        Drivers: [
          {
            ...raceSession().DriverInfo.Drivers[0],
            IsSpectator: 1,
          },
        ],
      },
    });

    detector.processTelemetry(makeTelemetry(), 5000);
    for (let i = 0; i < 4; i++) {
      detector.processTelemetry(
        makeTelemetry({ carIdxOnPitRoad: [true], sessionTime: 101 + i }),
        5000
      );
    }

    expect(incidents).toEqual([]);
  });

  it('fires PitEntry after pitEntryDebounce consecutive OnPitRoad frames', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, pitEntryDebounce: 3 },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // Seed frame (not on pit road)
    detector.processTelemetry(
      makeTelemetry({ carIdxOnPitRoad: [false] }),
      5000
    );
    expect(incidents).toHaveLength(0);

    // 2 frames on pit road — below debounce, should not fire yet
    for (let i = 0; i < 2; i++) {
      detector.processTelemetry(
        makeTelemetry({
          carIdxOnPitRoad: [true],
          sessionTime: 100.04 + i * 0.04,
        }),
        5000
      );
    }
    expect(incidents).toHaveLength(0);

    // 3rd consecutive frame — fires
    detector.processTelemetry(
      makeTelemetry({ carIdxOnPitRoad: [true], sessionTime: 100.12 }),
      5000
    );
    expect(incidents).toHaveLength(1);
    expect(incidents[0].type).toBe(IncidentType.PitEntry);
  });

  it('does not fire PitEntry for a single-frame OnPitRoad blip', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, pitEntryDebounce: 3 },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // Seed, then one blip on pit road, then back off
    detector.processTelemetry(
      makeTelemetry({ carIdxOnPitRoad: [false] }),
      5000
    );
    detector.processTelemetry(
      makeTelemetry({ carIdxOnPitRoad: [true], sessionTime: 100.04 }),
      5000
    );
    detector.processTelemetry(
      makeTelemetry({ carIdxOnPitRoad: [false], sessionTime: 100.08 }),
      5000
    );
    expect(
      incidents.filter((i) => i.type === IncidentType.PitEntry)
    ).toHaveLength(0);
  });
});

describe('off-track detection', () => {
  it('does not fire on first off-track frame', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // 1 off-track frame, debounce is 3 → no incident
    detector.processTelemetry(
      makeTelemetry({ carIdxTrackSurface: [TrackLocation.OffTrack] }),
      5000
    );
    expect(incidents).toHaveLength(0);
  });

  it('fires OffTrack after 3 consecutive off-track frames', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, offTrackDebounce: 3 },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // Seed frame (on-track) so detector has prev state before we count
    // off-track frames for the debounce.
    detector.processTelemetry(
      makeTelemetry({
        carIdxTrackSurface: [TrackLocation.OnTrack],
        sessionTime: 100,
      }),
      5000
    );
    for (let i = 0; i < 3; i++) {
      detector.processTelemetry(
        makeTelemetry({
          carIdxTrackSurface: [TrackLocation.OffTrack],
          sessionTime: 100.04 + i * 0.04,
        }),
        5000
      );
    }
    expect(incidents.some((i) => i.type === IncidentType.OffTrack)).toBe(true);
  });
});

describe('debounce cooldown recovery', () => {
  it('emits a pit entry after cooldown even when its threshold frame was suppressed', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(10_000);
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((incident) => incidents.push(incident));
    detector.updateSession(raceSession());
    detector.processTelemetry(makeTelemetry(), 5000);

    for (let i = 0; i < 3; i++) {
      detector.processTelemetry(
        makeTelemetry({ carIdxOnPitRoad: [true], sessionTime: 100.1 + i }),
        5000
      );
    }
    detector.processTelemetry(
      makeTelemetry({ carIdxOnPitRoad: [false], sessionTime: 104 }),
      5000
    );

    now.mockReturnValue(12_000);
    for (let i = 0; i < 3; i++) {
      detector.processTelemetry(
        makeTelemetry({ carIdxOnPitRoad: [true], sessionTime: 105 + i }),
        5000
      );
    }
    expect(
      incidents.filter((i) => i.type === IncidentType.PitEntry)
    ).toHaveLength(1);

    now.mockReturnValue(16_000);
    detector.processTelemetry(
      makeTelemetry({ carIdxOnPitRoad: [true], sessionTime: 108 }),
      5000
    );
    expect(
      incidents.filter((i) => i.type === IncidentType.PitEntry)
    ).toHaveLength(2);
    now.mockRestore();
  });

  it('emits an off-track after cooldown even when its threshold frame was suppressed', () => {
    const now = vi.spyOn(Date, 'now').mockReturnValue(10_000);
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((incident) => incidents.push(incident));
    detector.updateSession(raceSession());
    detector.processTelemetry(makeTelemetry(), 5000);

    for (let i = 0; i < 3; i++) {
      detector.processTelemetry(
        makeTelemetry({
          carIdxTrackSurface: [TrackLocation.OffTrack],
          sessionTime: 100.1 + i,
        }),
        5000
      );
    }
    detector.processTelemetry(makeTelemetry({ sessionTime: 104 }), 5000);

    now.mockReturnValue(12_000);
    for (let i = 0; i < 3; i++) {
      detector.processTelemetry(
        makeTelemetry({
          carIdxTrackSurface: [TrackLocation.OffTrack],
          sessionTime: 105 + i,
        }),
        5000
      );
    }
    expect(
      incidents.filter((i) => i.type === IncidentType.OffTrack)
    ).toHaveLength(1);

    now.mockReturnValue(16_000);
    detector.processTelemetry(
      makeTelemetry({
        carIdxTrackSurface: [TrackLocation.OffTrack],
        sessionTime: 108,
      }),
      5000
    );
    expect(
      incidents.filter((i) => i.type === IncidentType.OffTrack)
    ).toHaveLength(2);
    now.mockRestore();
  });
});

describe('crash detection - sustained slow', () => {
  it('fires Crash after avgSpeed < threshold for slowFrameThreshold consecutive frames', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, slowFrameThreshold: 3 },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // Seed frame first (establishes prev state; no detection runs).
    detector.processTelemetry(
      makeTelemetry({
        carIdxTrackSurface: [TrackLocation.OnTrack],
        carIdxOnPitRoad: [false],
        carIdxLapDistPct: [0.5],
        sessionTime: 100,
      }),
      5000
    );
    // 3 frames barely moving (< 15 km/h threshold)
    for (let i = 0; i < 3; i++) {
      detector.processTelemetry(
        makeTelemetry({
          carIdxTrackSurface: [TrackLocation.OnTrack],
          carIdxOnPitRoad: [false],
          carIdxLapDistPct: [0.5 + (i + 1) * 0.00001], // barely moving
          sessionTime: 100.04 + i * 0.04,
        }),
        5000
      );
    }
    expect(incidents.some((i) => i.type === IncidentType.Crash)).toBe(true);
  });

  it('does not fire when the session clock is frozen (paused replay)', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, slowFrameThreshold: 3 },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    detector.processTelemetry(
      makeTelemetry({ carIdxLapDistPct: [0.5], sessionTime: 100 }),
      5000
    );
    // Replay paused: sessionTime and position both frozen. Previously this
    // produced a 0 km/h reading every tick and crashed the whole field.
    for (let i = 0; i < 10; i++) {
      detector.processTelemetry(
        makeTelemetry({ carIdxLapDistPct: [0.5], sessionTime: 100 }),
        5000
      );
    }
    expect(incidents.some((i) => i.type === IncidentType.Crash)).toBe(false);
  });

  it('does not fire for a moving car whose position updates slower than we poll', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, slowFrameThreshold: 3 },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    detector.processTelemetry(
      makeTelemetry({ carIdxLapDistPct: [0.5], sessionTime: 100 }),
      5000
    );
    // Car is doing a healthy ~180 km/h, but its networked position only
    // refreshes every third tick — the two stale ticks in between must not be
    // read as 0 km/h.
    let pct = 0.5;
    for (let i = 1; i <= 12; i++) {
      if (i % 3 === 0) pct += 0.0004;
      detector.processTelemetry(
        makeTelemetry({
          carIdxLapDistPct: [pct],
          sessionTime: 100 + i * 0.04,
        }),
        5000
      );
    }
    expect(incidents.some((i) => i.type === IncidentType.Crash)).toBe(false);
  });

  it('measures remote movement across the full position-update interval', () => {
    const detector = new IncidentDetector(
      {
        ...defaultThresholds,
        slowFrameThreshold: 100,
        suddenStopFromSpeed: 80,
      },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((incident) => incidents.push(incident));
    detector.updateSession(raceSession());

    detector.processTelemetry(
      makeTelemetry({ carIdxLapDistPct: [0.5], sessionTime: 100 }),
      5000
    );
    detector.processTelemetry(
      makeTelemetry({ carIdxLapDistPct: [0.5], sessionTime: 100.04 }),
      5000
    );
    detector.processTelemetry(
      makeTelemetry({ carIdxLapDistPct: [0.5], sessionTime: 100.08 }),
      5000
    );
    // 0.0004 of a 5km lap over 0.12s is 60km/h. Measuring it against only
    // the latest 0.04s telemetry tick would incorrectly report 180km/h.
    detector.processTelemetry(
      makeTelemetry({ carIdxLapDistPct: [0.5004], sessionTime: 100.12 }),
      5000
    );

    // Admit stationary samples, but do not classify a stop from 60km/h as a
    // sudden-stop crash with an 80km/h threshold.
    detector.processTelemetry(
      makeTelemetry({ carIdxLapDistPct: [0.5004], sessionTime: 101.12 }),
      5000
    );
    detector.processTelemetry(
      makeTelemetry({ carIdxLapDistPct: [0.5004], sessionTime: 101.16 }),
      5000
    );

    expect(incidents.some((i) => i.type === IncidentType.Crash)).toBe(false);
  });

  it('fires for a racing car that remains completely stationary', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, slowFrameThreshold: 3 },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((incident) => incidents.push(incident));
    detector.updateSession(raceSession());

    detector.processTelemetry(
      makeTelemetry({ carIdxLapDistPct: [0.5], sessionTime: 100 }),
      5000
    );
    detector.processTelemetry(
      makeTelemetry({ carIdxLapDistPct: [0.5004], sessionTime: 100.04 }),
      5000
    );
    // Repeated positions below one second are treated as stale network data.
    detector.processTelemetry(
      makeTelemetry({ carIdxLapDistPct: [0.5004], sessionTime: 100.8 }),
      5000
    );
    expect(incidents).toEqual([]);

    // Once unchanged for a full second, zero-speed samples are admitted and
    // the normal sudden-stop/sustained-slow detectors can fire.
    for (let i = 0; i < 10; i++) {
      detector.processTelemetry(
        makeTelemetry({
          carIdxLapDistPct: [0.5004],
          sessionTime: 101.04 + i * 0.04,
        }),
        5000
      );
    }

    expect(incidents.some((i) => i.type === IncidentType.Crash)).toBe(true);
  });

  it('does not fire when a car parks after a qualifying run', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, slowFrameThreshold: 3 },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    // Same session state (Racing = green phase) but a Qualify session type.
    detector.updateSession({
      SessionInfo: {
        Sessions: [{ SessionNum: 0, SessionType: 'Open Qualify' }],
      },
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
    });

    // Slows from ~45 km/h and stops on track, as a driver does at the end of
    // a qualifying run.
    let pct = 0.5265;
    let t = 251;
    for (const step of [0.00025, 0.0002, 0.00012, 0.00005, 0.00001]) {
      pct += step;
      t += 0.05;
      detector.processTelemetry(
        makeTelemetry({ carIdxLapDistPct: [pct], sessionTime: t }),
        5000
      );
    }
    for (let i = 0; i < 12; i++) {
      pct += 0.0000005;
      t += 0.05;
      detector.processTelemetry(
        makeTelemetry({ carIdxLapDistPct: [pct], sessionTime: t }),
        5000
      );
    }

    expect(incidents.some((i) => i.type === IncidentType.Crash)).toBe(false);
  });

  it('does not fire while car is on pit road', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, slowFrameThreshold: 3 },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    for (let i = 0; i < 3; i++) {
      detector.processTelemetry(
        makeTelemetry({
          carIdxTrackSurface: [TrackLocation.OnTrack],
          carIdxOnPitRoad: [true], // on pit road
          carIdxLapDistPct: [0.5 + i * 0.00001],
          sessionTime: 100 + i * 0.04,
        }),
        5000
      );
    }
    expect(incidents.filter((i) => i.type === IncidentType.Crash)).toHaveLength(
      0
    );
  });

  it('does not fire sustained-slow during formation/pace lap (pre-Racing state)', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, slowFrameThreshold: 3 },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // Seed frame
    detector.processTelemetry(
      makeTelemetry({
        sessionState: SessionState.ParadeLaps,
        carIdxLapDistPct: [0.5],
        sessionTime: 100,
      }),
      5000
    );
    // 3 stationary frames — would fire if sessionState were Racing
    for (let i = 0; i < 3; i++) {
      detector.processTelemetry(
        makeTelemetry({
          sessionState: SessionState.ParadeLaps,
          carIdxTrackSurface: [TrackLocation.OnTrack],
          carIdxOnPitRoad: [false],
          carIdxLapDistPct: [0.5 + (i + 1) * 0.00001],
          sessionTime: 100.04 + i * 0.04,
        }),
        5000
      );
    }
    expect(incidents.filter((i) => i.type === IncidentType.Crash)).toHaveLength(
      0
    );
  });

  it('fires sustained-slow once session transitions to Racing', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, slowFrameThreshold: 3 },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // Pre-green: 10 stationary frames — counter is drained each frame
    detector.processTelemetry(
      makeTelemetry({
        sessionState: SessionState.ParadeLaps,
        sessionTime: 100,
      }),
      5000
    );
    for (let i = 0; i < 10; i++) {
      detector.processTelemetry(
        makeTelemetry({
          sessionState: SessionState.ParadeLaps,
          carIdxLapDistPct: [0.5 + (i + 1) * 0.00001],
          sessionTime: 100.04 + i * 0.04,
        }),
        5000
      );
    }
    expect(incidents.filter((i) => i.type === IncidentType.Crash)).toHaveLength(
      0
    );

    // Green flag — car still stationary on track, now detection is live
    for (let i = 0; i < 3; i++) {
      detector.processTelemetry(
        makeTelemetry({
          sessionState: SessionState.Racing,
          carIdxLapDistPct: [0.5 + (11 + i) * 0.00001],
          sessionTime: 100.44 + i * 0.04,
        }),
        5000
      );
    }
    expect(incidents.filter((i) => i.type === IncidentType.Crash)).toHaveLength(
      1
    );
  });
});

describe('dev mode debug snapshots', () => {
  const setupDetector = (isDev: boolean) => {
    const detector = new IncidentDetector(defaultThresholds, isDev);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());
    return { detector, incidents };
  };

  const triggerPitEntry = (detector: IncidentDetector, startTime = 100.04) => {
    for (let i = 0; i < 3; i++) {
      detector.processTelemetry(
        makeTelemetry({
          carIdxOnPitRoad: [true],
          sessionTime: startTime + i * 0.04,
        }),
        5000
      );
    }
  };

  it('attaches debug snapshot when isDev=true', () => {
    const { detector, incidents } = setupDetector(true);
    detector.processTelemetry(
      makeTelemetry({ carIdxOnPitRoad: [false] }),
      5000
    );
    triggerPitEntry(detector);
    const debug = incidents[0].debug;
    expect(debug).toBeDefined();
    expect(debug?.trigger).toBe('pit-entry');
    expect(debug?.evidence).toContain('Pit entry');
    expect(debug?.thresholds.slowSpeedThreshold).toBe(15);
    expect(debug?.frameHistory).toBeInstanceOf(Array);
  });

  it('does not attach debug snapshot when isDev=false', () => {
    const { detector, incidents } = setupDetector(false);
    detector.processTelemetry(
      makeTelemetry({ carIdxOnPitRoad: [false] }),
      5000
    );
    triggerPitEntry(detector);
    expect(incidents[0].debug).toBeUndefined();
  });

  it('frameHistory keeps roughly 3 seconds of frames, capped', () => {
    const { detector, incidents } = setupDetector(true);
    // More frames than the cap, so the ceiling is what gets asserted rather
    // than however many happened to be produced.
    for (let i = 0; i < 80; i++) {
      detector.processTelemetry(
        makeTelemetry({
          carIdxOnPitRoad: [false],
          sessionTime: 100 + i * 0.05,
          carIdxLapDistPct: [0.5 + i * 0.001],
        }),
        5000
      );
    }
    triggerPitEntry(detector, 104.5);
    expect(incidents[0].debug?.frameHistory.length).toBe(60);
  });

  it('frameHistory holds fewer frames than the cap early in a session', () => {
    const { detector, incidents } = setupDetector(true);
    for (let i = 0; i < 15; i++) {
      detector.processTelemetry(
        makeTelemetry({
          carIdxOnPitRoad: [false],
          sessionTime: 100 + i * 0.05,
          carIdxLapDistPct: [0.5 + i * 0.001],
        }),
        5000
      );
    }
    triggerPitEntry(detector, 100.8);
    const len = incidents[0].debug?.frameHistory.length ?? 0;
    expect(len).toBeGreaterThan(0);
    expect(len).toBeLessThan(60);
  });
});

describe('flag detection', () => {
  it('fires BlackFlag when Black flag bit newly set', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // No flag initially
    detector.processTelemetry(makeTelemetry({ carIdxSessionFlags: [0] }), 5000);
    expect(incidents).toHaveLength(0);

    // Black flag newly set
    detector.processTelemetry(
      makeTelemetry({
        carIdxSessionFlags: [GlobalFlags.Black],
        sessionTime: 100.04,
      }),
      5000
    );
    expect(incidents).toHaveLength(1);
    expect(incidents[0].type).toBe(IncidentType.BlackFlag);
  });

  it('fires BlackFlag when Disqualify flag bit newly set', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // No flag initially
    detector.processTelemetry(makeTelemetry({ carIdxSessionFlags: [0] }), 5000);
    expect(incidents).toHaveLength(0);

    // Disqualify flag newly set
    detector.processTelemetry(
      makeTelemetry({
        carIdxSessionFlags: [GlobalFlags.Disqualify],
        sessionTime: 100.04,
      }),
      5000
    );
    expect(incidents).toHaveLength(1);
    expect(incidents[0].type).toBe(IncidentType.BlackFlag);
  });

  it('fires Slowdown when Furled flag bit newly set', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession(raceSession());

    // No flag initially
    detector.processTelemetry(makeTelemetry({ carIdxSessionFlags: [0] }), 5000);
    expect(incidents).toHaveLength(0);

    // Furled flag newly set
    detector.processTelemetry(
      makeTelemetry({
        carIdxSessionFlags: [GlobalFlags.Furled],
        sessionTime: 100.04,
      }),
      5000
    );
    expect(incidents).toHaveLength(1);
    expect(incidents[0].type).toBe(IncidentType.Slowdown);
  });
});
