import { describe, it, expect } from 'vitest';
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

  it('returns 0 for backwards movement (collision nudge)', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const speed = detector.calculateSpeed(0.5, 0.499, 0.04, 5000);
    expect(speed).toBe(0);
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

describe('pit entry detection', () => {
  it('fires PitEntry after pitEntryDebounce consecutive OnPitRoad frames', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, pitEntryDebounce: 3 },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession({
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
    detector.updateSession({
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
    detector.updateSession({
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
    detector.updateSession({
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

describe('crash detection - sustained slow', () => {
  it('fires Crash after avgSpeed < threshold for slowFrameThreshold consecutive frames', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, slowFrameThreshold: 3 },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession({
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

  it('does not fire while car is on pit road', () => {
    const detector = new IncidentDetector(
      { ...defaultThresholds, slowFrameThreshold: 3 },
      false
    );
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession({
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
    detector.updateSession({
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
    detector.updateSession({
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
    detector.updateSession({
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

  it('frameHistory contains up to 10 most recent frames', () => {
    const { detector, incidents } = setupDetector(true);
    // Run 15 frames before triggering pit entry
    for (let i = 0; i < 15; i++) {
      detector.processTelemetry(
        makeTelemetry({
          carIdxOnPitRoad: [false],
          sessionTime: 100 + i * 0.04,
          carIdxLapDistPct: [0.5 + i * 0.001],
        }),
        5000
      );
    }
    triggerPitEntry(detector, 100.64);
    expect(incidents[0].debug?.frameHistory.length).toBe(10);
  });
});

describe('flag detection', () => {
  it('fires BlackFlag when Black flag bit newly set', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    const incidents: Incident[] = [];
    detector.onIncident((i) => incidents.push(i));
    detector.updateSession({
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
    detector.updateSession({
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
    detector.updateSession({
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
