import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@irdashies/utils/logger', () => ({
  default: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import type { LapTraceSampleSnapshot } from '@irdashies/types';
import {
  GARAGE61_NOT_IMPORTED_MESSAGE,
  useLapTraceStore,
} from './LapTraceStore';
import {
  GARAGE61_IMPORT_CAR_PATH,
  GARAGE61_IMPORT_TRACK_ID,
} from '../../domain/lapTrace/garage61CsvImport';
import {
  IBT_IMPORT_CAR_PATH,
  IBT_IMPORT_TRACK_ID,
} from '../../domain/lapTrace/ibtLapImport';
import {
  sampleGarage61Csv,
  sampleGarage61FileName,
} from '../../domain/lapTrace/fixtures/sampleGarage61Csv';

const TRACK_LENGTH_M = 100;
/** Frames per lap in the drive helpers — one every 5 m. */
const STEPS = 20;

interface Frame {
  pct: number;
  time: number;
  throttle?: number;
  brake?: number;
  speed?: number;
  gear?: number;
  abs?: boolean;
  onPitRoad?: boolean;
  onTrack?: boolean;
  lastLapTime?: number;
  lapCompleted?: number;
  /** PlayerCarMyIncidentCount at this instant — cumulative, not per-frame. */
  incidents?: number;
}

let version = 0;

const sample = (frame: Frame): LapTraceSampleSnapshot => ({
  sessionTime: frame.time,
  lapDistPct: frame.pct,
  throttle: frame.throttle ?? 0,
  brake: frame.brake ?? 0,
  speed: frame.speed ?? 40,
  gear: frame.gear ?? 3,
  brakeAbsActive: frame.abs ?? false,
  onPitRoad: frame.onPitRoad ?? false,
  isOnTrack: frame.onTrack ?? true,
  sessionNum: 0,
  lastLapTime: frame.lastLapTime ?? 0,
  lapCompleted: frame.lapCompleted ?? 0,
  incidentCount: frame.incidents ?? 0,
  version: ++version,
});

const feed = (frame: Frame) => {
  useLapTraceStore.getState().collectPlayerFrame(undefined, sample(frame));
};

/**
 * Session clock. Laps are contiguous — a lap starts when the previous one
 * crossed the line — so the helper advances a single clock rather than taking
 * an arbitrary start time.
 */
let clock = 0;

/**
 * Drive one full clean lap, one frame every 5 m, ending on the crossing frame.
 * The lap is captured as pending but not yet promoted — its official time has
 * not arrived, so the fresh active lap is left pristine.
 */
const driveLapAndCross = (lapTimeSec: number) => {
  const lapStart = clock;
  feed({ pct: 0, time: lapStart });
  const step = lapTimeSec / (STEPS + 1);
  for (let i = 0; i < STEPS; i++) {
    feed({ pct: 0.01 + i * 0.05, time: lapStart + step * (i + 1) });
  }
  clock = lapStart + lapTimeSec;
  // Crossing the line captures the lap; LapLastLapTime is still the previous
  // lap's value here (0 by default in these frames).
  feed({ pct: 0.01, time: clock });
};

/**
 * Drive a clean lap and then deliver its official LapLastLapTime a beat later
 * (it lags the crossing), which is what actually decides promotion.
 */
const driveCleanLap = (lapTimeSec: number, telemetryTime = lapTimeSec) => {
  driveLapAndCross(lapTimeSec);
  feed({ pct: 0.02, time: clock, lastLapTime: telemetryTime });
};

const activeLap = () => useLapTraceStore.getState().activeLap;

const makeBridge = (record: unknown = null, picked: unknown = null) => ({
  getLapTrace: vi.fn().mockResolvedValue(record),
  saveLapTrace: vi.fn().mockResolvedValue(undefined),
  clearLapTrace: vi.fn().mockResolvedValue(undefined),
  pickAndParseIbtLap: vi.fn(),
  fetchLapTraceFromGarage61: vi.fn(),
  pickGarage61Csv: vi.fn().mockResolvedValue(picked),
  notifyReferenceUpdated: vi.fn(),
  onReferenceUpdated: vi.fn(() => () => undefined),
  requestClearBestLap: vi.fn(),
  onClearBestLap: vi.fn(() => () => undefined),
  getCurrentBestLapInfo: vi.fn().mockResolvedValue(null),
  getGarage61SearchInfo: vi.fn().mockResolvedValue(null),
});

/**
 * A parsed .ibt lap for the session the harness initializes, so an import of it
 * counts as "for the track and car being driven now".
 */
const makeIbtResult = (fileName: string, lapTimeSec: number) => {
  const n = 40;
  const pct = new Float32Array(n);
  const timeSec = new Float32Array(n);
  const throttle = new Float32Array(n);
  const brake = new Float32Array(n);
  const speed = new Float32Array(n);
  const gear = new Float32Array(n);
  const absActive = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const f = i / (n - 1);
    pct[i] = f * 0.999;
    timeSec[i] = f * lapTimeSec;
    // Keyed off the lap time so each import is distinguishable in the samples.
    throttle[i] = lapTimeSec / 100;
    brake[i] = 0;
    speed[i] = 30;
    gear[i] = 4;
    absActive[i] = 0;
  }
  return {
    fileName,
    lapNumber: 1,
    lapTimeSec,
    trackId: 1,
    trackConfigName: 'Grand Prix',
    carPath: 'testcar',
    trackLengthM: TRACK_LENGTH_M,
    trackDisplayName: 'Test Circuit',
    driverName: 'Test Driver',
    carScreenName: 'Test Car',
    samples: { pct, timeSec, throttle, brake, speed, gear, absActive },
  };
};

describe('LapTraceStore', () => {
  beforeEach(async () => {
    clock = 0;
    useLapTraceStore.getState().reset();
    await useLapTraceStore
      .getState()
      .initialize(undefined, 1, 'Grand Prix', 'testcar', TRACK_LENGTH_M);
  });

  it('allocates an active lap for a valid session', () => {
    const state = useLapTraceStore.getState();
    expect(state.trackLengthM).toBe(TRACK_LENGTH_M);
    expect(state.activeLap).not.toBeNull();
    expect(state.activeLap?.samples.length).toBe(0);
  });

  it('refuses to initialize without a car path', async () => {
    useLapTraceStore.getState().reset();
    await useLapTraceStore
      .getState()
      .initialize(undefined, 1, 'Grand Prix', '', TRACK_LENGTH_M);
    expect(useLapTraceStore.getState().activeLap).toBeNull();
  });

  it('stores every advancing frame as one sample with its exact pedal values', () => {
    feed({ pct: 0, time: 0 });
    feed({ pct: 0.01, time: 1, throttle: 0.2, brake: 0.3 });
    feed({ pct: 0.012, time: 2, throttle: 0.8, brake: 0.7 });
    feed({ pct: 0.014, time: 3, throttle: 0.8, brake: 0.1 });

    const lap = activeLap();
    expect(lap?.samples.length).toBe(4);
    // No aggregation: a lift and a stab are two samples, not one blend.
    expect(lap?.samples.throttle[1]).toBeCloseTo(0.2, 5);
    expect(lap?.samples.brake[2]).toBeCloseTo(0.7, 5);
    expect(lap?.samples.brake[3]).toBeCloseTo(0.1, 5);
    expect(lap?.samples.distanceM[3]).toBeCloseTo(1.4, 4);
    expect(lap?.samples.gear[3]).toBe(3);
  });

  it('keeps the sample clock relative to the first sample of the lap', () => {
    feed({ pct: 0, time: 10 });
    feed({ pct: 0.01, time: 10.5 });
    feed({ pct: 0.02, time: 11.25 });
    const lap = activeLap();
    expect(lap?.samples.timeSec[0]).toBe(0);
    expect(lap?.samples.timeSec[1]).toBeCloseTo(0.5, 5);
    expect(lap?.samples.timeSec[2]).toBeCloseTo(1.25, 5);
  });

  it('drops a frame that does not advance along the lap', () => {
    feed({ pct: 0, time: 0 });
    feed({ pct: 0.01, time: 1 });
    feed({ pct: 0.01, time: 2 });
    feed({ pct: 0.01000001, time: 3 });
    expect(activeLap()?.samples.length).toBe(2);
  });

  it('records ABS per sample', () => {
    feed({ pct: 0, time: 0 });
    feed({ pct: 0.01, time: 1, abs: false });
    feed({ pct: 0.012, time: 2, abs: true });
    feed({ pct: 0.014, time: 3, abs: false });
    expect(
      Array.from(activeLap()?.samples.absActive.slice(0, 4) ?? [])
    ).toEqual([0, 0, 1, 0]);
  });

  it('notifies subscribers every few metres, not every frame', () => {
    feed({ pct: 0, time: 0 });
    const listener = vi.fn();
    const unsubscribe = useLapTraceStore.subscribe(listener);

    feed({ pct: 0.01, time: 1 }); // 1 m on — under the interval
    feed({ pct: 0.03, time: 2 }); // 3 m
    expect(listener).not.toHaveBeenCalled();

    feed({ pct: 0.06, time: 3 }); // 6 m — past it
    expect(listener).toHaveBeenCalledTimes(1);

    feed({ pct: 0.08, time: 4 }); // 8 m — 2 m since the last notification
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('tracks the running speed range for the plot scale', () => {
    feed({ pct: 0, time: 0 });
    feed({ pct: 0.01, time: 1, speed: 30 });
    feed({ pct: 0.06, time: 2, speed: 70 });
    expect(activeLap()?.speedMinMs).toBe(30);
    expect(activeLap()?.speedMaxMs).toBe(70);
  });

  it('marks the lap dirty on pit road', () => {
    feed({ pct: 0, time: 0 });
    expect(activeLap()?.isCleanLap).toBe(true);
    feed({ pct: 0.01, time: 1, onPitRoad: true });
    expect(activeLap()?.isCleanLap).toBe(false);
  });

  it('marks the lap dirty when off track', () => {
    feed({ pct: 0, time: 0 });
    feed({ pct: 0.01, time: 1, onTrack: false });
    expect(activeLap()?.isCleanLap).toBe(false);
  });

  it('marks the lap dirty when an incident is picked up mid-lap', () => {
    feed({ pct: 0, time: 0, incidents: 2 });
    expect(activeLap()?.isCleanLap).toBe(true);
    // The count only ever rises, so this reads as one new incident.
    feed({ pct: 0.01, time: 1, incidents: 3 });
    expect(activeLap()?.isCleanLap).toBe(false);
  });

  it('does not dirty a lap when the incident count merely holds steady', () => {
    feed({ pct: 0, time: 0, incidents: 5 });
    feed({ pct: 0.01, time: 1, incidents: 5 });
    feed({ pct: 0.02, time: 2, incidents: 5 });
    expect(activeLap()?.isCleanLap).toBe(true);
  });

  it('marks the lap dirty when the car teleports', () => {
    feed({ pct: 0, time: 0 });
    feed({ pct: 0.01, time: 1 });
    // 1 m -> 60 m between two frames: a tow, not driving.
    feed({ pct: 0.6, time: 2 });
    expect(activeLap()?.isCleanLap).toBe(false);
    // The sample is still kept so the trace shows where the car reappeared.
    expect(activeLap()?.samples.length).toBe(3);
  });

  it('marks the lap dirty when the car goes backwards', () => {
    feed({ pct: 0, time: 0 });
    feed({ pct: 0.5, time: 1 });
    feed({ pct: 0.4, time: 2 });
    expect(activeLap()?.isCleanLap).toBe(false);
    expect(activeLap()?.samples.length).toBe(2);
  });

  it('does not start timing a lap joined mid-way', () => {
    useLapTraceStore.getState().reset();
    return useLapTraceStore
      .getState()
      .initialize(undefined, 1, 'Grand Prix', 'testcar', TRACK_LENGTH_M)
      .then(() => {
        feed({ pct: 0.5, time: 10 });
        expect(activeLap()?.isCleanLap).toBe(false);
        expect(activeLap()?.startTime).toBe(Number.MAX_SAFE_INTEGER);
        // The frames are still recorded — the corner panel can use them.
        expect(activeLap()?.samples.length).toBe(1);
      });
  });

  it('promotes a clean lap to the reference', () => {
    driveCleanLap(90);

    const state = useLapTraceStore.getState();
    expect(state.referenceLap).not.toBeNull();
    expect(state.referenceLap?.lapTimeSec).toBeCloseTo(90, 5);
    expect(state.referenceLap?.source.kind).toBe('best');
    expect(state.referenceLap?.samples.length).toBe(STEPS + 1);
    expect(state.bestLapTimeSec).toBeCloseTo(90, 5);
  });

  it('starts a fresh lap at the crossing frame', () => {
    feed({ pct: 0, time: 0 });
    const serial = activeLap()?.lapSerial ?? -1;
    driveLapAndCross(90);
    const lap = activeLap();
    // The crossing frame is the new lap's first sample — nothing from the
    // previous lap survives, so the ghost can never show a stale trace.
    expect(lap?.samples.length).toBe(1);
    expect(lap?.samples.distanceM[0]).toBeCloseTo(1, 4);
    expect(lap?.samples.timeSec[0]).toBe(0);
    expect(lap?.isCleanLap).toBe(true);
    expect(lap?.lapSerial).toBe(serial + 1);
  });

  it('does not promote a dirty lap', () => {
    feed({ pct: 0, time: 0 });
    for (let i = 0; i < STEPS; i++) {
      feed({ pct: 0.01 + i * 0.05, time: i + 1, onPitRoad: i === 3 });
    }
    feed({ pct: 0.01, time: 90 });
    feed({ pct: 0.02, time: 90, lastLapTime: 90 });

    expect(useLapTraceStore.getState().referenceLap).toBeNull();
  });

  it('never promotes an invalid lap, even as the first and only lap driven', () => {
    // The exact regression reported: the very first lap of the session, and
    // the only one timed so far — it must still never become the best.
    feed({ pct: 0, time: 0 });
    for (let i = 0; i < STEPS; i++) {
      // One incident partway through the lap; the count never drops back down.
      feed({ pct: 0.01 + i * 0.05, time: i + 1, incidents: i >= 8 ? 1 : 0 });
    }
    feed({ pct: 0.01, time: 90, incidents: 1 });
    feed({ pct: 0.02, time: 90, lastLapTime: 90, incidents: 1 });

    const state = useLapTraceStore.getState();
    expect(state.referenceLap).toBeNull();
    expect(state.bestLapTimeSec).toBe(Number.POSITIVE_INFINITY);
  });

  it('drops a pending lap invalidated by an incident reported only after the crossing', () => {
    // The incident telemetry lags a tick or two behind the crossing itself —
    // the crossing frame still reads the old (0) count, so the lap is
    // snapshotted as clean. The count rises only afterwards, before the
    // official lap time has even settled.
    feed({ pct: 0, time: 0 });
    for (let i = 0; i < STEPS; i++) {
      feed({ pct: 0.01 + i * 0.05, time: i + 1 });
    }
    feed({ pct: 0.01, time: 90 });
    expect(useLapTraceStore.getState().pendingBest).not.toBeNull();

    feed({ pct: 0.02, time: 90, lastLapTime: 90, incidents: 1 });

    const state = useLapTraceStore.getState();
    expect(state.referenceLap).toBeNull();
    expect(state.bestLapTimeSec).toBe(Number.POSITIVE_INFINITY);
  });

  it('does not promote a slower lap over the existing best', () => {
    driveCleanLap(90);
    const first = useLapTraceStore.getState().referenceLap;

    driveCleanLap(95);

    const state = useLapTraceStore.getState();
    expect(state.bestLapTimeSec).toBeCloseTo(90, 5);
    expect(state.referenceLap).toBe(first);
  });

  it('promotes a faster lap over the existing best', () => {
    driveCleanLap(90);
    driveCleanLap(85);
    expect(useLapTraceStore.getState().bestLapTimeSec).toBeCloseTo(85, 5);
  });

  it('does not promote until the official lap time settles', () => {
    // Crossing the line alone captures the lap but must not promote it — the
    // telemetry lap time has not arrived yet.
    driveLapAndCross(90);
    expect(useLapTraceStore.getState().referenceLap).toBeNull();
    expect(useLapTraceStore.getState().bestLapTimeSec).toBe(
      Number.POSITIVE_INFINITY
    );

    // The settled LapLastLapTime, a beat later, is what promotes.
    feed({ pct: 0.02, time: clock, lastLapTime: 90 });
    expect(useLapTraceStore.getState().referenceLap?.lapTimeSec).toBe(90);
  });

  it('records the telemetry lap time, not the coarse sessionTime delta', () => {
    // The frames imply a 90.000 s delta, but the official time is 90.123.
    driveCleanLap(90, 90.123);
    expect(useLapTraceStore.getState().referenceLap?.lapTimeSec).toBe(90.123);
    expect(useLapTraceStore.getState().bestLapTimeSec).toBe(90.123);
  });

  it('drops a captured lap whose official time never arrives', () => {
    // First lap: cross the line but never deliver its LapLastLapTime.
    driveLapAndCross(90);
    expect(useLapTraceStore.getState().pendingBest).not.toBeNull();

    // A second clean crossing arrives before the first ever settled; the stale
    // pending lap is discarded rather than mis-timed against the newer lap.
    driveLapAndCross(88);
    // Neither lap was ever promoted, because no official time was delivered.
    expect(useLapTraceStore.getState().referenceLap).toBeNull();
    expect(useLapTraceStore.getState().bestLapTimeSec).toBe(
      Number.POSITIVE_INFINITY
    );
  });

  describe('active reset', () => {
    /**
     * A telemetry frame's worth of time. Frames this close apart are what makes
     * a teleport unmistakable — the same move spread over a second is just a
     * fast car.
     */
    const FRAME = 1 / 60;

    /** Drive to 60% of the lap, then Active Reset back to 20%. */
    const driveAndReset = () => {
      feed({ pct: 0, time: 0 });
      feed({ pct: 0.2, time: 4 });
      feed({ pct: 0.4, time: 8 });
      feed({ pct: 0.6, time: 12 });
      feed({ pct: 0.2, time: 12 + FRAME });
    };

    it('discards the lap in progress when the car is teleported back', () => {
      feed({ pct: 0, time: 0 });
      feed({ pct: 0.2, time: 4 });
      feed({ pct: 0.4, time: 8 });
      feed({ pct: 0.6, time: 12 });
      const serial = activeLap()?.lapSerial ?? -1;
      expect(activeLap()?.samples.length).toBe(4);

      feed({ pct: 0.2, time: 12 + FRAME });

      const lap = activeLap();
      // Nothing from before the reset survives: the buffer's tail sat ahead of
      // where the car now is, so keeping it would freeze the trace until the
      // car drove back past 60%.
      expect(lap?.samples.length).toBe(1);
      expect(lap?.samples.distanceM[0]).toBeCloseTo(20, 4);
      expect(lap?.samples.timeSec[0]).toBe(0);
      // The signal every consumer resynchronises on.
      expect(lap?.lapSerial).toBe(serial + 1);
    });

    it('never lets the restarted partial lap be promoted', () => {
      driveAndReset();
      const lap = activeLap();
      expect(lap?.isCleanLap).toBe(false);
      expect(lap?.startTime).toBe(Number.MAX_SAFE_INTEGER);
    });

    it('keeps recording forwards from the reset point', () => {
      driveAndReset();
      feed({ pct: 0.25, time: 13 });
      feed({ pct: 0.3, time: 14 });
      const lap = activeLap();
      expect(lap?.samples.length).toBe(3);
      expect(Array.from(lap?.samples.distanceM.slice(0, 3) ?? [])).toEqual([
        20, 25, 30,
      ]);
    });

    it('does not treat a teleport across the line as a completed lap', () => {
      // A reset point set just past start/finish: the car jumps from 60% to 2%
      // without ever driving the last 40% of the lap.
      feed({ pct: 0, time: 0 });
      feed({ pct: 0.3, time: 6 });
      feed({ pct: 0.6, time: 12 });
      feed({ pct: 0.02, time: 12 + FRAME });

      // The crossing test alone would have snapshotted this as a clean lap.
      expect(useLapTraceStore.getState().pendingBest).toBeNull();
      feed({ pct: 0.04, time: 13, lastLapTime: 12 });
      expect(useLapTraceStore.getState().referenceLap).toBeNull();
      expect(useLapTraceStore.getState().bestLapTimeSec).toBe(
        Number.POSITIVE_INFINITY
      );
    });

    it('still promotes the next full lap driven after a reset', () => {
      driveAndReset();
      // Back round to the line under the car's own power, which starts a
      // normal lap again.
      for (let i = 5; i < STEPS; i++) {
        feed({ pct: 0.01 + i * 0.05, time: 13 + i });
      }
      clock = 40;
      feed({ pct: 0.01, time: clock });
      feed({ pct: 0.02, time: clock, lastLapTime: 88 });
      expect(useLapTraceStore.getState().pendingBest).toBeNull();
      expect(useLapTraceStore.getState().referenceLap).toBeNull();

      driveCleanLap(90);
      expect(useLapTraceStore.getState().bestLapTimeSec).toBeCloseTo(90, 5);
    });

    it('leaves an already-completed lap waiting for its official time alone', () => {
      // The lap is over and snapshotted; only its LapLastLapTime is still in
      // flight. A reset afterwards must not throw that lap away.
      driveLapAndCross(90);
      expect(useLapTraceStore.getState().pendingBest).not.toBeNull();

      feed({ pct: 0.35, time: clock + 6 });
      feed({ pct: 0.05, time: clock + 6 + FRAME });
      expect(activeLap()?.samples.length).toBe(1);

      feed({ pct: 0.07, time: clock + 7, lastLapTime: 90 });
      expect(useLapTraceStore.getState().bestLapTimeSec).toBeCloseTo(90, 5);
    });

    it('restarts when SessionTime runs backwards', () => {
      feed({ pct: 0, time: 100 });
      feed({ pct: 0.1, time: 102 });
      const serial = activeLap()?.lapSerial ?? -1;
      // A replay scrub, or the session clock restarting.
      feed({ pct: 0.11, time: 20 });
      expect(activeLap()?.lapSerial).toBe(serial + 1);
      expect(activeLap()?.samples.length).toBe(1);
    });
  });

  it('clears the stored best lap and resets the promotion threshold', async () => {
    driveCleanLap(90);
    expect(useLapTraceStore.getState().bestLapTimeSec).toBeCloseTo(90, 5);
    expect(useLapTraceStore.getState().referenceLap).not.toBeNull();

    const bridge = makeBridge();
    await useLapTraceStore.getState().clearBestLap(bridge);

    const state = useLapTraceStore.getState();
    // Keyed to the initialized track/car (see beforeEach).
    expect(bridge.clearLapTrace).toHaveBeenCalledWith(1, 'testcar', 'best');
    expect(state.bestLapTimeSec).toBe(Number.POSITIVE_INFINITY);
    // The on-screen best reference is dropped so it stops showing a lap that no
    // longer exists.
    expect(state.referenceLap).toBeNull();
  });

  it('copies the promoted lap so the recorder can reuse its buffer', () => {
    driveCleanLap(90);
    const reference = useLapTraceStore.getState().referenceLap;
    const lap = activeLap();
    expect(reference?.samples.distanceM).not.toBe(lap?.samples.distanceM);
    expect(reference?.samples.length).toBe(STEPS + 1);

    // Driving on must not disturb the promoted copy.
    const firstThrottle = reference?.samples.throttle[0];
    feed({ pct: 0.03, time: clock + 1, throttle: 1 });
    expect(reference?.samples.throttle[0]).toBe(firstThrottle);
    expect(reference?.samples.length).toBe(STEPS + 1);
  });

  it('persists a promoted lap through the bridge', async () => {
    const bridge = makeBridge();

    useLapTraceStore.getState().reset();
    await useLapTraceStore
      .getState()
      .initialize(bridge, 7, 'Grand Prix', 'gt3car', TRACK_LENGTH_M);

    const { collectPlayerFrame } = useLapTraceStore.getState();
    collectPlayerFrame(bridge, sample({ pct: 0, time: 0 }));
    for (let i = 0; i < STEPS; i++) {
      collectPlayerFrame(bridge, sample({ pct: 0.01 + i * 0.05, time: i + 1 }));
    }
    // Cross the line, then a frame carrying the settled LapLastLapTime.
    collectPlayerFrame(bridge, sample({ pct: 0.01, time: 90 }));
    collectPlayerFrame(
      bridge,
      sample({ pct: 0.02, time: 90, lastLapTime: 90, lapCompleted: 1 })
    );

    expect(bridge.saveLapTrace).toHaveBeenCalledWith(
      7,
      'gt3car',
      'best',
      expect.objectContaining({
        schemaVersion: 2,
        trackId: 7,
        trackLengthM: TRACK_LENGTH_M,
        lapTimeSec: 90,
        samples: expect.objectContaining({ length: STEPS + 1 }),
      })
    );
  });

  it('ignores frames before telemetry is valid', () => {
    feed({ pct: -1, time: 0 });
    feed({ pct: 0.1, time: -1 });
    expect(activeLap()?.samples.length).toBe(0);
  });

  it('records a brake application point between samples', () => {
    // Two samples 4 m apart, brake rising 0 -> 0.12, so the 0.01 threshold
    // is crossed 1/12 of the way in.
    feed({ pct: 0, time: 0 });
    feed({ pct: 0.5, time: 1, brake: 0 });
    feed({ pct: 0.54, time: 2, brake: 0.12 });

    const lap = activeLap();
    expect(lap?.events.brakeOnCount).toBe(1);
    // 0.5 lap = 50 m, plus (0.01 / 0.12) of the 4 m step ≈ 50.333 m.
    expect(lap?.events.brakeOnM[0]).toBeCloseTo(50.3333, 3);
  });

  it('records brake release and throttle application separately', () => {
    feed({ pct: 0, time: 0 });
    feed({ pct: 0.2, time: 1, brake: 0 });
    feed({ pct: 0.25, time: 2, brake: 1 });
    feed({ pct: 0.3, time: 3, brake: 0 });
    feed({ pct: 0.35, time: 4, throttle: 1 });

    const lap = activeLap();
    expect(lap?.events.brakeOnCount).toBe(1);
    expect(lap?.events.brakeOffCount).toBe(1);
    expect(lap?.events.throttleOnCount).toBe(1);
    expect(lap?.events.brakeOffM[0]).toBeGreaterThan(
      lap?.events.brakeOnM[0] ?? 0
    );
  });

  it('does not re-trigger while the pedal stays applied', () => {
    feed({ pct: 0, time: 0 });
    feed({ pct: 0.2, time: 1, brake: 0.5 });
    feed({ pct: 0.25, time: 2, brake: 0.9 });
    feed({ pct: 0.3, time: 3, brake: 0.4 });
    expect(activeLap()?.events.brakeOnCount).toBe(1);
  });

  it('ignores pedal noise that stays below the on-threshold', () => {
    feed({ pct: 0, time: 0 });
    // Wobbling below the 0.01 on-threshold must not emit anything.
    feed({ pct: 0.2, time: 1, brake: 0.004 });
    feed({ pct: 0.25, time: 2, brake: 0.008 });
    feed({ pct: 0.3, time: 3, brake: 0.005 });
    expect(activeLap()?.events.brakeOnCount).toBe(0);
  });

  it('derives the same application points on the promoted reference', () => {
    feed({ pct: 0, time: 0 });
    for (let i = 0; i < STEPS; i++) {
      feed({
        pct: 0.01 + i * 0.05,
        time: i + 1,
        brake: i === 10 ? 1 : 0,
        throttle: i === 12 ? 1 : 0,
      });
    }
    const live = activeLap()?.events;
    const liveBrakeOnM = live?.brakeOnM[0];
    clock = 90;
    feed({ pct: 0.01, time: clock });
    // The official lap time settles a beat later, promoting the lap.
    feed({ pct: 0.02, time: clock, lastLapTime: 90 });

    const events = useLapTraceStore.getState().referenceLap?.events;
    expect(events?.brakeOnM.length).toBe(1);
    expect(events?.throttleOnM.length).toBe(1);
    expect(events?.brakeOnM[0]).toBe(liveBrakeOnM);
  });

  it('does not replace an imported reference with a new personal best', () => {
    // Comparing against a Garage 61 import: beating your own best still records
    // and saves the lap, but the lap on screen must stay the one you chose to
    // chase rather than silently becoming your own.
    useLapTraceStore.setState({
      referenceSource: 'garage61',
      referenceLap: null,
      bestLapTimeSec: 120,
    });

    driveCleanLap(60);

    expect(useLapTraceStore.getState().bestLapTimeSec).toBe(60);
    expect(useLapTraceStore.getState().referenceLap).toBeNull();
  });

  it('still swaps in a new personal best when showing the best lap', () => {
    useLapTraceStore.setState({
      referenceSource: 'best',
      referenceLap: null,
      bestLapTimeSec: 120,
    });

    driveCleanLap(60);

    expect(useLapTraceStore.getState().bestLapTimeSec).toBe(60);
    expect(useLapTraceStore.getState().referenceLap).not.toBeNull();
  });

  it('clears application points when the next lap starts', () => {
    feed({ pct: 0, time: 0 });
    feed({ pct: 0.2, time: 1, brake: 1 });
    expect(activeLap()?.events.brakeOnCount).toBe(1);

    for (let i = 4; i < STEPS; i++) {
      feed({ pct: 0.01 + i * 0.05, time: i + 1 });
    }
    clock = 90;
    feed({ pct: 0.01, time: clock });

    expect(activeLap()?.events.brakeOnCount).toBe(0);
    expect(activeLap()?.events.brakeIsOn).toBe(false);
  });

  it('resets everything, keeping no lap resident', () => {
    driveCleanLap(90);
    useLapTraceStore.getState().reset();

    const state = useLapTraceStore.getState();
    expect(state.activeLap).toBeNull();
    expect(state.referenceLap).toBeNull();
    expect(state.trackLengthM).toBe(0);
    expect(state.trackId).toBeNull();
    expect(state.bestLapTimeSec).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('LapTraceStore ghost carry-over', () => {
  beforeEach(async () => {
    clock = 0;
    useLapTraceStore.getState().reset();
    await useLapTraceStore
      .getState()
      .initialize(undefined, 1, 'Grand Prix', 'testcar', TRACK_LENGTH_M);
  });

  const carryOver = () => useLapTraceStore.getState().activeLap?.carryOver;

  it('has nothing to carry before the first crossing', () => {
    feed({ pct: 0, time: 0 });
    feed({ pct: 0.3, time: 6 });

    expect(carryOver()?.length).toBe(0);
  });

  it('keeps the end of the lap just finished when the line is crossed', () => {
    driveLapAndCross(90);

    const tail = carryOver();
    // The finished lap ran to 96 m of this 100 m track; that is the road
    // immediately behind the car now, and it has to survive the rewind.
    expect(tail?.length).toBeGreaterThan(1);
    expect(tail?.lastDistanceM()).toBeCloseTo(96, 5);
  });

  it('keeps the carry-over independent of the lap now being recorded', () => {
    driveLapAndCross(90);
    const tailLength = carryOver()?.length;

    // Drive well into the new lap: its own buffer fills from zero again.
    feed({ pct: 0.2, time: clock + 5 });
    feed({ pct: 0.4, time: clock + 10 });

    expect(carryOver()?.length).toBe(tailLength);
    expect(carryOver()?.lastDistanceM()).toBeCloseTo(96, 5);
    expect(useLapTraceStore.getState().activeLap?.samples.lastDistanceM()).toBe(
      40
    );
  });

  it('replaces the carry-over at each crossing', () => {
    driveLapAndCross(90);
    driveLapAndCross(85);

    expect(carryOver()?.lastDistanceM()).toBeCloseTo(96, 5);
    expect(carryOver()?.length).toBeGreaterThan(1);
  });

  it('drops the carry-over when the car is teleported', () => {
    driveLapAndCross(90);
    expect(carryOver()?.length).toBeGreaterThan(1);

    // An Active Reset drops the car somewhere it did not drive to. The road
    // behind it was never driven into, so keeping the previous lap's tail
    // would draw a stretch of trace the car was never on.
    const frameSec = 1 / 60;
    feed({ pct: 0.3, time: clock + 6 });
    feed({ pct: 0.6, time: clock + 12 });
    feed({ pct: 0.2, time: clock + 12 + frameSec });

    expect(carryOver()?.length).toBe(0);
  });

  it('drops the carry-over when the session restarts mid-lap', () => {
    driveLapAndCross(90);
    expect(carryOver()?.length).toBeGreaterThan(1);

    useLapTraceStore.getState().reset();
    expect(carryOver()).toBeUndefined();
  });
});

describe('LapTraceStore best-lap promotion', () => {
  beforeEach(() => {
    clock = 0;
    useLapTraceStore.getState().reset();
  });

  const initWith = async (bridge: ReturnType<typeof makeBridge>) =>
    useLapTraceStore
      .getState()
      .initialize(bridge, 1, 'Grand Prix', 'testcar', TRACK_LENGTH_M);

  it('promotes once the stored best has been read', async () => {
    const bridge = makeBridge(null);
    await initWith(bridge);

    driveCleanLap(90);

    expect(useLapTraceStore.getState().bestLapTimeSec).toBe(90);
  });

  it('will not promote before the stored best is known', async () => {
    const bridge = makeBridge(null);
    // Initialize without awaiting: the read is still in flight, exactly as it
    // is for the first moments of a session.
    void initWith(bridge);

    driveCleanLap(90);

    // A lap finishing in that window would otherwise beat the infinite
    // starting threshold and overwrite a genuinely faster stored lap.
    expect(useLapTraceStore.getState().bestLapTimeSec).toBe(
      Number.POSITIVE_INFINITY
    );
  });

  it('will not promote when the stored best could not be read', async () => {
    const bridge = makeBridge(null);
    bridge.getLapTrace.mockRejectedValue(new Error('disk gone'));
    await initWith(bridge);

    driveCleanLap(90);

    // A best that cannot be read is not a best that can be beaten.
    expect(useLapTraceStore.getState().bestLapTimeSec).toBe(
      Number.POSITIVE_INFINITY
    );
  });

  it('promotes again after the driver clears the best', async () => {
    const bridge = makeBridge(null);
    bridge.getLapTrace.mockRejectedValue(new Error('disk gone'));
    await initWith(bridge);

    await useLapTraceStore.getState().clearBestLap(bridge);
    driveCleanLap(95);

    // Clearing tells us the slot is empty, so there is nothing left to guard.
    expect(useLapTraceStore.getState().bestLapTimeSec).toBe(95);
  });
});

describe('LapTraceStore import failures', () => {
  beforeEach(() => {
    useLapTraceStore.getState().reset();
  });

  const failingBridge = (error: unknown) => {
    const bridge = makeBridge();
    bridge.pickAndParseIbtLap.mockRejectedValue(error);
    bridge.pickGarage61Csv.mockRejectedValue(error);
    return bridge;
  };

  it('strips the IPC channel name from the message', async () => {
    const bridge = failingBridge(
      new Error(
        "Error invoking remote method 'lapTrace:pickAndParseIbt': " +
          'Error: No complete, clean lap was found in the file'
      )
    );

    const result = await useLapTraceStore.getState().importIbtLap(bridge);

    expect(result).toEqual({
      ok: false,
      error: 'Error: No complete, clean lap was found in the file',
    });
  });

  it('leaves a message that was never wrapped alone', async () => {
    const bridge = failingBridge(new Error('Not a valid .ibt file'));

    const result = await useLapTraceStore.getState().importIbtLap(bridge);

    expect(result).toEqual({ ok: false, error: 'Not a valid .ibt file' });
  });

  it('falls back when the failure carries no message', async () => {
    const bridge = failingBridge('not an error at all');

    const result = await useLapTraceStore.getState().importIbtLap(bridge);

    expect(result).toEqual({
      ok: false,
      error: 'Could not import the .ibt file',
    });
  });

  it('clears the stored lap so a failed import leaves nothing behind', async () => {
    const bridge = failingBridge(new Error('broken file'));
    useLapTraceStore.setState({
      referenceSource: 'manual',
      referenceLap: {} as never,
    });

    await useLapTraceStore.getState().importIbtLap(bridge);

    // Both slots are global, so a lap kept from an earlier import would be
    // rescaled onto whatever track is loaded and read as the file that just
    // failed, drawn wrong.
    expect(bridge.clearLapTrace).toHaveBeenCalledWith(
      IBT_IMPORT_TRACK_ID,
      IBT_IMPORT_CAR_PATH,
      'manual'
    );
    expect(useLapTraceStore.getState().referenceLap).toBeNull();
    expect(useLapTraceStore.getState().referenceError).toContain('Import an');
  });

  it('does the same for a failed Garage 61 import', async () => {
    const bridge = failingBridge(new Error('broken file'));
    useLapTraceStore.setState({
      referenceSource: 'garage61',
      referenceLap: {} as never,
    });

    await useLapTraceStore.getState().importGarage61Lap(bridge);

    expect(bridge.clearLapTrace).toHaveBeenCalledWith(
      GARAGE61_IMPORT_TRACK_ID,
      GARAGE61_IMPORT_CAR_PATH,
      'garage61'
    );
    expect(useLapTraceStore.getState().referenceLap).toBeNull();
  });

  it('leaves another source on screen untouched', async () => {
    const bridge = failingBridge(new Error('broken file'));
    const showing = {} as never;
    useLapTraceStore.setState({
      referenceSource: 'best',
      referenceLap: showing,
    });

    await useLapTraceStore.getState().importIbtLap(bridge);

    // The stored .ibt still goes, but the personal best on screen stays.
    expect(useLapTraceStore.getState().referenceLap).toBe(showing);
  });
});

describe('LapTraceStore.setReferenceFromSource', () => {
  const storedRecord = (overrides = {}) => {
    const n = STEPS;
    return {
      schemaVersion: 2,
      source: { kind: 'best', label: 'Personal Best', importedAt: 0 },
      trackId: 1,
      trackConfigName: 'Grand Prix',
      carPath: 'testcar',
      trackLengthM: TRACK_LENGTH_M,
      lapTimeSec: 88,
      samples: {
        length: n,
        distanceM: Float32Array.from({ length: n }, (_, i) => i * 5),
        timeSec: Float32Array.from({ length: n }, (_, i) => i * 4.4),
        throttle: new Float32Array(n).fill(1),
        brake: new Float32Array(n),
        speed: new Float32Array(n).fill(40),
        gear: new Float32Array(n).fill(3),
        absActive: new Float32Array(n),
      },
      recordedAt: 0,
      ...overrides,
    };
  };

  beforeEach(() => {
    useLapTraceStore.getState().reset();
  });

  it('loads and hydrates a stored lap', async () => {
    const bridge = makeBridge(storedRecord());
    await useLapTraceStore
      .getState()
      .initialize(bridge, 1, 'Grand Prix', 'testcar', TRACK_LENGTH_M);
    await useLapTraceStore.getState().setReferenceFromSource(bridge, 'best');

    const reference = useLapTraceStore.getState().referenceLap;
    expect(reference?.lapTimeSec).toBe(88);
    expect(reference?.speedMaxMs).toBe(40);
    expect(reference?.events.brakeOnM.length).toBe(0);
  });

  it('rejects a lap recorded on a different track config', async () => {
    const bridge = makeBridge(storedRecord({ trackConfigName: 'Reverse' }));
    await useLapTraceStore
      .getState()
      .initialize(bridge, 1, 'Grand Prix', 'testcar', TRACK_LENGTH_M);
    await useLapTraceStore.getState().setReferenceFromSource(bridge, 'best');

    expect(useLapTraceStore.getState().referenceLap).toBeNull();
  });

  it('rejects a lap from another schema version', async () => {
    const bridge = makeBridge(storedRecord({ schemaVersion: 1 }));
    await useLapTraceStore
      .getState()
      .initialize(bridge, 1, 'Grand Prix', 'testcar', TRACK_LENGTH_M);
    await useLapTraceStore.getState().setReferenceFromSource(bridge, 'best');

    const state = useLapTraceStore.getState();
    expect(state.referenceLap).toBeNull();
    expect(state.referenceError).toBeNull();
    // Nor does it seed the promotion threshold.
    expect(state.bestLapTimeSec).toBe(Number.POSITIVE_INFINITY);
  });

  it('rescales a lap saved with a slightly different track length', async () => {
    const bridge = makeBridge(storedRecord({ trackLengthM: 101 }));
    await useLapTraceStore
      .getState()
      .initialize(bridge, 1, 'Grand Prix', 'testcar', TRACK_LENGTH_M);
    await useLapTraceStore.getState().setReferenceFromSource(bridge, 'best');

    const reference = useLapTraceStore.getState().referenceLap;
    expect(reference?.trackLengthM).toBe(TRACK_LENGTH_M);
    const last = STEPS - 1;
    expect(reference?.samples.distanceM[last]).toBeCloseTo(
      (last * 5 * 100) / 101,
      3
    );
    expect(reference?.samples.timeSec[last]).toBeCloseTo(last * 4.4, 3);
  });

  it('prompts to import an .ibt lap when the manual source has none stored', async () => {
    const bridge = makeBridge(null);
    await useLapTraceStore
      .getState()
      .initialize(bridge, 1, 'Grand Prix', 'testcar', TRACK_LENGTH_M);
    await useLapTraceStore.getState().setReferenceFromSource(bridge, 'manual');

    const state = useLapTraceStore.getState();
    expect(state.referenceLap).toBeNull();
    expect(state.referenceError).toMatch(/import an \.ibt lap/i);
  });

  it('leaves no error for a best lap that simply has not been driven', async () => {
    const bridge = makeBridge(null);
    await useLapTraceStore
      .getState()
      .initialize(bridge, 1, 'Grand Prix', 'testcar', TRACK_LENGTH_M);
    await useLapTraceStore.getState().setReferenceFromSource(bridge, 'best');

    const state = useLapTraceStore.getState();
    expect(state.referenceLap).toBeNull();
    expect(state.referenceError).toBeNull();
  });

  it('seeds the promotion threshold from the stored best', async () => {
    const bridge = makeBridge(storedRecord());
    await useLapTraceStore
      .getState()
      .initialize(bridge, 1, 'Grand Prix', 'testcar', TRACK_LENGTH_M);
    expect(useLapTraceStore.getState().bestLapTimeSec).toBe(88);
  });

  it('looks up garage61 via the sentinel key, not the live session', async () => {
    const bridge = makeBridge(
      storedRecord({
        source: { kind: 'garage61', label: 'Imported', importedAt: 0 },
      })
    );
    await useLapTraceStore
      .getState()
      .initialize(bridge, 1, 'Grand Prix', 'testcar', TRACK_LENGTH_M);
    await useLapTraceStore
      .getState()
      .setReferenceFromSource(bridge, 'garage61');

    expect(bridge.getLapTrace).toHaveBeenCalledWith(
      GARAGE61_IMPORT_TRACK_ID,
      GARAGE61_IMPORT_CAR_PATH,
      'garage61'
    );
    expect(useLapTraceStore.getState().referenceLap?.source.label).toBe(
      'Imported'
    );
  });

  it('resolves garage61 even before a session has ever initialized the store', async () => {
    const bridge = makeBridge(
      storedRecord({
        source: { kind: 'garage61', label: 'Imported', importedAt: 0 },
      })
    );
    await useLapTraceStore
      .getState()
      .setReferenceFromSource(bridge, 'garage61');

    expect(useLapTraceStore.getState().referenceLap?.source.label).toBe(
      'Imported'
    );
  });

  it('reports that nothing has been imported yet for garage61', async () => {
    const bridge = makeBridge(null);
    await useLapTraceStore
      .getState()
      .setReferenceFromSource(bridge, 'garage61');

    const state = useLapTraceStore.getState();
    expect(state.referenceLap).toBeNull();
    expect(state.referenceError).toBe(GARAGE61_NOT_IMPORTED_MESSAGE);
  });
});

describe('LapTraceStore.importGarage61Lap', () => {
  beforeEach(() => {
    useLapTraceStore.getState().reset();
  });

  it('saves the parsed record under the sentinel key', async () => {
    const bridge = makeBridge(null, {
      fileName: sampleGarage61FileName,
      csvText: sampleGarage61Csv,
    });

    const result = await useLapTraceStore.getState().importGarage61Lap(bridge);

    expect(result).toEqual({
      ok: true,
      label: 'Test Driver - Test Car - Test Track (Full)',
      // Reported so Settings can show it on its own row, as .ibt already does.
      lapTimeSec: 60.895,
      driver: 'Test Driver',
      car: 'Test Car',
      track: 'Test Track (Full)',
    });
    expect(bridge.saveLapTrace).toHaveBeenCalledWith(
      GARAGE61_IMPORT_TRACK_ID,
      GARAGE61_IMPORT_CAR_PATH,
      'garage61',
      expect.objectContaining({
        schemaVersion: 2,
        source: expect.objectContaining({ kind: 'garage61' }),
      })
    );
  });

  it('reports a cancelled picker without saving anything', async () => {
    const bridge = makeBridge(null, null);

    const result = await useLapTraceStore.getState().importGarage61Lap(bridge);

    expect(result).toEqual({ ok: 'cancelled' });
    expect(bridge.saveLapTrace).not.toHaveBeenCalled();
  });

  it('surfaces a parse failure without saving anything', async () => {
    const bridge = makeBridge(null, {
      fileName: 'lap.csv',
      csvText: 'Speed\n1\n',
    });

    const result = await useLapTraceStore.getState().importGarage61Lap(bridge);

    expect(result.ok).toBe(false);
    expect(bridge.saveLapTrace).not.toHaveBeenCalled();
  });

  it('refreshes the visible reference immediately when garage61 is already selected', async () => {
    const bridge = makeBridge(null, {
      fileName: sampleGarage61FileName,
      csvText: sampleGarage61Csv,
    });
    useLapTraceStore.setState({
      referenceError: GARAGE61_NOT_IMPORTED_MESSAGE,
    });

    await useLapTraceStore.getState().importGarage61Lap(bridge);

    const state = useLapTraceStore.getState();
    expect(state.referenceLap?.source.kind).toBe('garage61');
    expect(state.referenceError).toBeNull();
  });
});

describe('LapTraceStore.importIbtLap', () => {
  /**
   * A bridge backed by a real key/value map, so a save is visible to the next
   * read. The overlay reloads from disk after Settings imports, and a mock that
   * always resolves the same record cannot show whether that works.
   */
  const makeStoringBridge = () => {
    const stored = new Map<string, unknown>();
    const bridge = makeBridge();
    bridge.saveLapTrace.mockImplementation(
      async (
        trackId: number,
        carPath: string,
        kind: string,
        record: unknown
      ) => {
        stored.set(`${trackId}|${carPath}|${kind}`, record);
      }
    );
    bridge.getLapTrace.mockImplementation(
      async (trackId: number, carPath: string, kind: string) =>
        stored.get(`${trackId}|${carPath}|${kind}`) ?? null
    );
    return bridge;
  };

  const importLap = async (
    bridge: ReturnType<typeof makeStoringBridge>,
    fileName: string,
    lapTimeSec: number
  ) => {
    bridge.pickAndParseIbtLap.mockResolvedValue(
      makeIbtResult(fileName, lapTimeSec)
    );
    return useLapTraceStore.getState().importIbtLap(bridge);
  };

  beforeEach(async () => {
    useLapTraceStore.getState().reset();
    await useLapTraceStore
      .getState()
      .initialize(undefined, 1, 'Grand Prix', 'testcar', TRACK_LENGTH_M);
    useLapTraceStore.setState({ referenceSource: 'manual' });
  });

  it('replaces the on-screen reference when a second file is imported', async () => {
    const bridge = makeStoringBridge();

    await importLap(bridge, 'first.ibt', 90);
    expect(useLapTraceStore.getState().referenceLap?.source.ref).toBe(
      'first.ibt'
    );
    expect(useLapTraceStore.getState().referenceLap?.lapTimeSec).toBe(90);

    await importLap(bridge, 'second.ibt', 84);

    const reference = useLapTraceStore.getState().referenceLap;
    expect(reference?.source.ref).toBe('second.ibt');
    expect(reference?.lapTimeSec).toBe(84);
    // The samples themselves must be the new lap's, not just the label.
    expect(reference?.samples.throttle[0]).toBeCloseTo(0.84, 5);
  });

  it('overwrites the stored lap so a reload sees the second import', async () => {
    const bridge = makeStoringBridge();

    await importLap(bridge, 'first.ibt', 90);
    await importLap(bridge, 'second.ibt', 84);

    // What the overlay does when Settings tells it a reference changed.
    await useLapTraceStore.getState().setReferenceFromSource(bridge, 'manual');

    const reference = useLapTraceStore.getState().referenceLap;
    expect(reference?.source.ref).toBe('second.ibt');
    expect(reference?.lapTimeSec).toBe(84);
  });

  it('tells the other window to reload after every import', async () => {
    const bridge = makeStoringBridge();

    await importLap(bridge, 'first.ibt', 90);
    await importLap(bridge, 'second.ibt', 84);

    expect(bridge.notifyReferenceUpdated).toHaveBeenCalledTimes(2);
  });

  it('shows a lap driven on another track and car', async () => {
    const bridge = makeStoringBridge();
    await importLap(bridge, 'first.ibt', 90);

    // Same picker flow, but the file's own session identity is elsewhere.
    bridge.pickAndParseIbtLap.mockResolvedValue({
      ...makeIbtResult('other-track.ibt', 70),
      trackId: 2,
      carPath: 'othercar',
    });
    const result = await useLapTraceStore.getState().importIbtLap(bridge);

    // One global slot, not one per circuit, so the file the driver just
    // picked is the one on screen wherever they happen to be.
    expect(result).toMatchObject({ ok: true, fileName: 'other-track.ibt' });
    expect(bridge.saveLapTrace).toHaveBeenLastCalledWith(
      IBT_IMPORT_TRACK_ID,
      IBT_IMPORT_CAR_PATH,
      'manual',
      expect.anything()
    );

    await useLapTraceStore.getState().setReferenceFromSource(bridge, 'manual');
    expect(useLapTraceStore.getState().referenceLap?.source.ref).toBe(
      'other-track.ibt'
    );
  });

  it('loads an imported lap with no session of its own', async () => {
    const bridge = makeStoringBridge();
    await importLap(bridge, 'first.ibt', 90);

    // Settings has no live track or car; the slot has to be reachable anyway.
    useLapTraceStore.getState().reset();
    await useLapTraceStore.getState().setReferenceFromSource(bridge, 'manual');

    expect(useLapTraceStore.getState().referenceLap?.source.ref).toBe(
      'first.ibt'
    );
  });

  it('leaves the reference alone while another source is selected', async () => {
    const bridge = makeStoringBridge();
    useLapTraceStore.setState({ referenceSource: 'best' });

    await importLap(bridge, 'first.ibt', 90);

    expect(useLapTraceStore.getState().referenceLap).toBeNull();
    expect(bridge.notifyReferenceUpdated).toHaveBeenCalledTimes(1);
  });
});
