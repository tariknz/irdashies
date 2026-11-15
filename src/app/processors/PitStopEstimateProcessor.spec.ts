import { describe, expect, it, vi } from 'vitest';
import type {
  PitStopModelFile,
  PitStopReport,
  ReferenceLap,
  ReferenceLapsSnapshot,
  Session,
  Telemetry,
} from '@irdashies/types';
import { GlobalFlags, TrackLocation } from '@irdashies/types';
import type { PitStopModelPersistence } from '../storage/pitStopModel';
import {
  memoryOverlay,
  PitStopEstimateProcessor,
} from './PitStopEstimateProcessor';

const PLAYER = 0;
const OPPONENT = 1;
const TRACK_SPEED = 0.01;
const LANE_SPEED = 0.005;

const session = (sessionType = 'Race'): Session =>
  ({
    WeekendInfo: {
      TrackID: 10,
      SeriesID: 1,
      TrackLength: '5.00 km',
      TrackPitSpeedLimit: '60.00 kph',
      BuildVersion: 'test',
      AltAssetTag: undefined,
    },
    DriverInfo: {
      DriverCarIdx: PLAYER,
      DriverCarFuelMaxLtr: 100,
      DriverCarMaxFuelPct: 1,
      Drivers: [
        {
          CarIdx: PLAYER,
          CarID: 20,
          CarClassID: 30,
          CarPath: 'ferrari296gt3',
          CarClassEstLapTime: 100,
          CarIsPaceCar: 0,
          IsSpectator: 0,
        },
        {
          CarIdx: OPPONENT,
          CarID: 21,
          CarClassID: 30,
          CarPath: 'bmwm4gt3',
          CarClassEstLapTime: 100,
          CarIsPaceCar: 0,
          IsSpectator: 0,
        },
      ],
    },
    SessionInfo: { Sessions: [{ SessionNum: 0, SessionType: sessionType }] },
  }) as unknown as Session;

/** An even-paced 100 s lap. */
const referenceLap = (): ReferenceLap => {
  const points = 100;
  const pointPos = new Float32Array(points);
  const times = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    pointPos[i] = i / points;
    times[i] = i;
  }
  return {
    pointPos,
    times,
    tangents: new Float32Array(points),
    interval: 0.01,
    pointsCount: points,
    startTime: 0,
    finishTime: 100,
    lastTrackedPct: 0.99,
    isCleanLap: true,
  };
};

const references: ReferenceLapsSnapshot = {
  bestLaps: [],
  persistedLaps: [[30, referenceLap()]],
  sessionNum: 0,
  version: 1,
};

const emptyFile = (): PitStopModelFile => ({
  version: 1,
  transit: {},
  service: {},
  overrides: {},
  order: [],
});

/** One earlier player stop here with a 15 s lane loss. */
const learnedFile = (): PitStopModelFile => {
  const file = emptyFile();
  file.transit['10:20'] = [
    {
      at: 1,
      build: 'test',
      seriesId: 1,
      trackId: 10,
      carId: 20,
      carClassId: 30,
      ruleSet: 'default',
      source: 'player',
      pitSpeedLimitKph: 60,
      entryPct: 0.9,
      exitPct: 0.05,
      windowSeconds: 50,
      stationarySeconds: 20,
      referenceSeconds: 15,
      windowStartPct: 0.88,
      windowEndPct: 0.07,
    },
  ];
  return file;
};

const memoryStore = (file = emptyFile()) => {
  const store: PitStopModelPersistence = {
    read: () => file,
    addTransit: vi.fn((key, sample) => {
      file.transit[key] = [...(file.transit[key] ?? []), sample];
    }),
    addService: vi.fn((key, sample) => {
      file.service[key] = [...(file.service[key] ?? []), sample];
    }),
  };
  return store;
};

interface CarState {
  pct: number;
  onPitRoad: boolean;
  surface: number;
}

/** Starts at 0.5, enters the lane at 0.9, stops 20 s at 0.95, exits at 0.05. */
const pittingCar = (t: number): CarState => {
  if (t < 40)
    return {
      pct: 0.5 + t * TRACK_SPEED,
      onPitRoad: false,
      surface: TrackLocation.OnTrack,
    };
  if (t < 50)
    return {
      pct: 0.9 + (t - 40) * LANE_SPEED,
      onPitRoad: true,
      surface: TrackLocation.ApproachingPits,
    };
  if (t < 70)
    return { pct: 0.95, onPitRoad: true, surface: TrackLocation.InPitStall };
  if (t < 90)
    return {
      pct: (0.95 + (t - 70) * LANE_SPEED) % 1,
      onPitRoad: true,
      surface: TrackLocation.ApproachingPits,
    };
  return {
    pct: (0.05 + (t - 90) * TRACK_SPEED) % 1,
    onPitRoad: false,
    surface: TrackLocation.OnTrack,
  };
};

const drivingCar =
  (start: number) =>
  (t: number): CarState => ({
    pct: (start + t * TRACK_SPEED) % 1,
    onPitRoad: false,
    surface: TrackLocation.OnTrack,
  });

const frame = (
  t: number,
  player: CarState,
  opponent: CarState,
  extra: { caution?: boolean } = {}
): Telemetry =>
  ({
    SessionTime: { value: [t] },
    SessionNum: { value: [0] },
    CarIdxLap: { value: [3, 3] },
    SessionFlags: {
      value: [extra.caution ? GlobalFlags.Caution : GlobalFlags.Green],
    },
    IsOnTrack: { value: [true] },
    CarIdxLapDistPct: { value: [player.pct, opponent.pct] },
    CarIdxOnPitRoad: { value: [player.onPitRoad, opponent.onPitRoad] },
    CarIdxTrackSurface: { value: [player.surface, opponent.surface] },
    PitstopActive: { value: [player.surface === TrackLocation.InPitStall] },
    FuelLevel: {
      value: [t < 52 ? 20 : t < 68 ? 20 + 2.5 * (t - 52) : 60],
    },
    PitSvFlags: { value: [0b1111 | 0x10] },
    PitSvFuel: { value: [60] },
    PitRepairLeft: { value: [0] },
    PlayerCarTowTime: { value: [0] },
  }) as unknown as Telemetry;

const create = (
  store = memoryStore(),
  report: (report: PitStopReport) => void = vi.fn(),
  lapTimes: number[] = []
) => {
  const processor = new PitStopEstimateProcessor({
    persistence: store,
    referenceLaps: () => references,
    fuel: () => undefined,
    lapTimes: () => ({
      lapTimes,
      lapTimeHistory: [],
      sessionNum: 0,
      version: 1,
    }),
    report,
  });
  processor.onLifecycle({ type: 'enter', replay: false });
  processor.init(session());
  return processor;
};

const drive = (
  processor: PitStopEstimateProcessor,
  player: (t: number) => CarState,
  opponent: (t: number) => CarState,
  until = 110,
  caution: boolean | ((t: number) => boolean) = false,
  from = 0
) => {
  for (let i = Math.round(from * 10); i <= until * 10; i++) {
    const t = i / 10;
    processor.onFrame(
      frame(t, player(t), opponent(t), {
        caution: typeof caution === 'function' ? caution(t) : caution,
      })
    );
  }
};

describe('PitStopEstimateProcessor', () => {
  it('stays hidden without dependencies', () => {
    const processor = new PitStopEstimateProcessor(null);
    processor.init(session());
    processor.onFrame(frame(1, drivingCar(0.5)(1), drivingCar(0.2)(1)));
    expect(processor.snapshot().state).toBe('hidden');
  });

  it('learns lane loss from an opponent stop', () => {
    const store = memoryStore();
    const processor = create(store);
    drive(processor, drivingCar(0.3), pittingCar);
    expect(store.addTransit).toHaveBeenCalledTimes(1);
    const [key, sample] = vi.mocked(store.addTransit).mock.calls[0];
    expect(key).toBe('10:21');
    expect(sample).toMatchObject({ source: 'opponent', carClassId: 30 });
    // The window runs 300 m before entry to 500 m after exit (0.84 to 0.15):
    // 66 s, 20 of them in the stall, against 31 s on the reference lap.
    expect(sample.windowSeconds).toBeCloseTo(66, 0);
    expect(sample.stationarySeconds).toBeCloseTo(20, 0);
    expect(sample.referenceSeconds).toBeCloseTo(31, 0);
  });

  it('records the player service and reports predicted against actual', () => {
    const store = memoryStore(learnedFile());
    const report = vi.fn();
    const processor = create(store, report);
    drive(processor, pittingCar, drivingCar(0.2));
    expect(store.addService).toHaveBeenCalledTimes(1);
    const [key, sample] = vi.mocked(store.addService).mock.calls[0];
    expect(store.addTransit).toHaveBeenCalledWith(
      '10:20',
      expect.objectContaining({ source: 'player' })
    );
    expect(key).toBe('default:20');
    expect(sample.fuelAddedLitres).toBeCloseTo(40, 0);
    expect(sample.fuelSeconds).toBeCloseTo(16, 0);
    expect(sample.stationarySeconds).toBeCloseTo(20, 0);

    expect(report).toHaveBeenCalledTimes(1);
    const sent = report.mock.calls[0][0] as PitStopReport;
    expect(sent.predicted).toMatchObject({
      tableRow: 'gt3',
      fuelSource: 'pitMenu',
      tyres: 4,
    });
    expect(sent.actualLossSeconds).toBeCloseTo(66 - 31, 0);
    expect(sent.predicted?.lossSeconds).toBeCloseTo(61.5, 0);
    expect(sent.actualTyres).toBe(4);
    expect(JSON.stringify(sent)).not.toMatch(/Name|UserID|CustID/i);
    expect(sent).toMatchObject({
      seriesId: 1,
      sessionType: 'Race',
      lap: 3,
      cautionDuringStop: false,
      taintReasons: [],
      firstTaintSeconds: null,
      actualAheadCarIdx: 1,
      actualBehindCarIdx: 1,
    });
    expect(sent.at).toBeGreaterThan(0);
    // One other car on an even 100 s lap: ahead and behind gaps fill the lap.
    expect(
      (sent.actualAheadGapSeconds ?? 0) + (sent.actualBehindGapSeconds ?? 0)
    ).toBeCloseTo(100, 0);
    expect(sent.predictedAheadGapSeconds).not.toBeNull();
  });

  it('moves other cars at their own pace in the predicted gaps', () => {
    // Positive: the other car ahead of the rejoin point; negative: behind.
    const signedGap = (lapTimes: number[]) => {
      const report = vi.fn();
      const processor = create(memoryStore(learnedFile()), report, lapTimes);
      drive(processor, pittingCar, drivingCar(0.2));
      const sent = report.mock.calls[0][0] as PitStopReport;
      return (
        sent.predictedAheadGapSeconds ??
        -(sent.predictedBehindGapSeconds ?? NaN)
      );
    };
    const samePace = signedGap([100, 100]);
    const fasterCar = signedGap([100, 80]);
    expect(Number.isFinite(samePace)).toBe(true);
    expect(Number.isFinite(fasterCar)).toBe(true);
    expect(Math.abs(fasterCar - samePace)).toBeGreaterThan(5);
  });

  it('flags a caution during the stop and reports no actual loss', () => {
    const report = vi.fn();
    const processor = create(memoryStore(learnedFile()), report);
    drive(processor, pittingCar, drivingCar(0.2), 110, (t) => t >= 60);
    const sent = report.mock.calls[0][0] as PitStopReport;
    expect(sent.cautionDuringStop).toBe(true);
    expect(sent.taintReasons).toEqual(['caution']);
    expect(sent.firstTaintSeconds).toBeCloseTo(20, 1);
    expect(sent.actualLossSeconds).toBeNull();
  });

  it('measures the actual gaps at the window end, back at racing speed', () => {
    // Twice the player's pace: 15 s behind at the exit line (t 90), 5 s
    // behind at the window end (t 100).
    const fast = (t: number): CarState => ({
      pct: (0.1 + t * 2 * TRACK_SPEED) % 1,
      onPitRoad: false,
      surface: TrackLocation.OnTrack,
    });
    const report = vi.fn();
    const processor = create(memoryStore(learnedFile()), report);
    drive(processor, pittingCar, fast);
    const sent = report.mock.calls[0][0] as PitStopReport;
    expect(sent.actualBehindCarIdx).toBe(1);
    expect(sent.actualBehindGapSeconds).toBeCloseTo(5, 0);
  });

  it('keeps the rejoin point through the stop, counting down the loss', () => {
    const processor = create(memoryStore(learnedFile()));
    let next = 0;
    const at = (t: number) => {
      drive(processor, pittingCar, drivingCar(0.2), t, false, next);
      next = t + 0.1;
      return processor.snapshot();
    };
    // Window start 0.84 at 34 s. At 45 s: 11 s gone, 8.5 s on the
    // reference, so 2.5 s of the planned 61.5 s are lost.
    const inLane = at(45);
    expect(inLane).toMatchObject({
      state: 'ok',
      inStop: true,
      lossSeconds: 59,
    });
    expect(inLane.offsetPct).toBeCloseTo(0.59, 2);
    // 10 s into a stall planned at 46.5 s: still the plan.
    expect(at(60).lossSeconds).toBeCloseTo(46.5, 1);
    // Service done after 20 s: 15 s lane + 20 s stall, 27.5 s lost so far.
    expect(at(75).lossSeconds).toBeCloseTo(7.5, 1);
    // Rejoined: the full 35 s is lost.
    expect(at(95)).toMatchObject({ inStop: true, lossSeconds: 0 });
    // Past the window end: the estimate for the next stop.
    const after = at(101);
    expect(after.inStop).toBe(false);
    expect(after.lossSeconds).toBeGreaterThan(30);
  });

  it('shows the cars either side of the rejoin point', () => {
    const processor = create(memoryStore(learnedFile()));
    drive(processor, drivingCar(0.7), drivingCar(0.2), 1);
    // Rejoin point 61.5 s behind 0.71, at 0.095; the other car is at 0.21.
    expect(processor.snapshot()).toMatchObject({
      aheadCarIdx: OPPONENT,
      aheadGapSeconds: 11.5,
      behindCarIdx: null,
      behindGapSeconds: null,
      inStop: false,
    });
  });

  it('places the rejoin point lane loss plus service behind the player', () => {
    const processor = create(memoryStore(learnedFile()));
    drive(processor, drivingCar(0.7), drivingCar(0.2), 1);
    // Lane 15 s, plus 2.5 s overhead, 60 L at 2.5 L/s and four tyres in
    // sequence (24 + 20).
    expect(processor.snapshot()).toMatchObject({
      state: 'ok',
      lossSeconds: 61.5,
      lapsLost: 0,
    });
    expect(processor.snapshot().offsetPct).toBeCloseTo(0.615, 3);
    expect(processor.snapshot().offsetFarPct).toBeGreaterThan(0.615);
    expect(processor.snapshot().offsetNearPct).toBeLessThan(0.615);
  });

  it('models the lane loss and says so before any stop is seen', () => {
    const processor = create();
    processor.init(session());
    const withCalibration = new PitStopEstimateProcessor({
      persistence: memoryStore(),
      referenceLaps: () => references,
      fuel: () => undefined,
      pitLane: () => Promise.resolve({ pitEntryPct: 0.9, pitExitPct: 0.05 }),
    });
    withCalibration.onLifecycle({ type: 'enter', replay: false });
    withCalibration.init(session());
    return Promise.resolve().then(() => {
      drive(withCalibration, drivingCar(0.7), drivingCar(0.2), 1);
      expect(withCalibration.snapshot().state).toBe('calibrating');
      expect(withCalibration.snapshot().offsetPct).not.toBeNull();
      drive(processor, drivingCar(0.7), drivingCar(0.2), 1);
      expect(processor.snapshot()).toMatchObject({
        state: 'calibrating',
        offsetPct: null,
      });
    });
  });

  it('flags the estimate as unreliable under caution', () => {
    const file = emptyFile();
    const processor = create(memoryStore(file));
    drive(processor, drivingCar(0.3), pittingCar);
    drive(processor, drivingCar(0.7), drivingCar(0.2), 1, true);
    expect(processor.snapshot().state).toBe('unreliable');
  });

  it('is hidden outside races but still learns', () => {
    const store = memoryStore();
    const processor = create(store);
    processor.init(session('Practice'));
    drive(processor, drivingCar(0.3), pittingCar);
    expect(processor.snapshot().state).toBe('hidden');
    expect(store.addTransit).toHaveBeenCalledTimes(1);
  });

  it('neither shows nor learns while an iRacing replay is watched', () => {
    const store = memoryStore();
    const processor = create(store);
    processor.onLifecycle({ type: 'enter', replay: true });
    drive(processor, drivingCar(0.3), pittingCar);
    expect(processor.snapshot().state).toBe('hidden');
    expect(store.addTransit).not.toHaveBeenCalled();
  });
});

describe('memoryOverlay', () => {
  it('learns in memory without touching saved data', () => {
    const base = memoryStore();
    const overlay = memoryOverlay(base);
    overlay.addTransit('10:20', {} as never);
    expect(overlay.read().transit['10:20']).toHaveLength(1);
    expect(base.read().transit['10:20']).toBeUndefined();
    expect(base.addTransit).not.toHaveBeenCalled();
  });
});
