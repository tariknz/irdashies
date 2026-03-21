import { describe, it, expect } from 'vitest';
import { IncidentDetector } from './incidentDetector';
import type { IncidentThresholds } from '../../types/raceControl';
import { IncidentType } from '../../types/raceControl';
import type { Incident } from '../../types/raceControl';
import { TrackLocation, GlobalFlags } from '../irsdk/types/enums';

const defaultThresholds: IncidentThresholds = {
  slowSpeedThreshold: 15,
  slowFrameThreshold: 10,
  suddenStopFromSpeed: 80,
  suddenStopToSpeed: 20,
  suddenStopFrames: 3,
  offTrackDebounce: 3,
  cooldownSeconds: 5,
};

const makeTelemetry = (
  overrides: Partial<{
    sessionTime: number;
    sessionNum: number;
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
  it('clears car states when session updates', () => {
    const detector = new IncidentDetector(defaultThresholds, false);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (detector as any).carStates.set(0, { slowFrameCount: 5 });
    detector.updateSession({ DriverInfo: { Drivers: [] } });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((detector as any).carStates.size).toBe(0);
  });
});

describe('pit entry detection', () => {
  it('fires PitEntry when CarIdxOnPitRoad transitions false → true', () => {
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

    const baseTelemetry = makeTelemetry({ carIdxOnPitRoad: [false] });
    detector.processTelemetry(baseTelemetry, 5000);
    expect(incidents).toHaveLength(0);

    const pitTelemetry = makeTelemetry({
      carIdxOnPitRoad: [true],
      sessionTime: 100.04,
    });
    detector.processTelemetry(pitTelemetry, 5000);
    expect(incidents).toHaveLength(1);
    expect(incidents[0].type).toBe(IncidentType.PitEntry);
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

    for (let i = 0; i < 3; i++) {
      detector.processTelemetry(
        makeTelemetry({
          carIdxTrackSurface: [TrackLocation.OffTrack],
          sessionTime: 100 + i * 0.04,
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

    // 3 frames barely moving (< 15 km/h threshold)
    for (let i = 0; i < 3; i++) {
      detector.processTelemetry(
        makeTelemetry({
          carIdxTrackSurface: [TrackLocation.OnTrack],
          carIdxOnPitRoad: [false],
          carIdxLapDistPct: [0.5 + i * 0.00001], // barely moving
          sessionTime: 100 + i * 0.04,
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

  it('attaches debug snapshot when isDev=true', () => {
    const { detector, incidents } = setupDetector(true);
    detector.processTelemetry(
      makeTelemetry({ carIdxOnPitRoad: [false] }),
      5000
    );
    detector.processTelemetry(
      makeTelemetry({ carIdxOnPitRoad: [true], sessionTime: 100.04 }),
      5000
    );
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
    detector.processTelemetry(
      makeTelemetry({ carIdxOnPitRoad: [true], sessionTime: 100.04 }),
      5000
    );
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
    detector.processTelemetry(
      makeTelemetry({ carIdxOnPitRoad: [true], sessionTime: 100.64 }),
      5000
    );
    expect(incidents[0].debug?.frameHistory.length).toBeLessThanOrEqual(10);
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
