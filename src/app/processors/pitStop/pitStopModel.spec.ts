import { describe, expect, it } from 'vitest';
import type {
  FuelLapData,
  PitServiceSample,
  PitStopModelFile,
  PitTransitSample,
  ReferenceLap,
} from '@irdashies/types';
import {
  fuelStopNeeded,
  median,
  modelLaneLoss,
  nearestAround,
  pctAtTime,
  rejoinOffset,
  resolveLaneLoss,
  resolveServiceRule,
  serviceEstimate,
  serviceSeconds,
  spanSeconds,
  timeAtPct,
  tyreCount,
} from './pitStopModel';

/** A lap of `seconds`, with the first half of the lap driven twice as slowly. */
const referenceLap = (
  seconds = 90,
  points = 100,
  uneven = false
): ReferenceLap => {
  const pointPos = new Float32Array(points);
  const times = new Float32Array(points);
  for (let i = 0; i < points; i++) {
    const pct = i / points;
    pointPos[i] = pct;
    times[i] = uneven
      ? pct < 0.5
        ? (pct * (seconds * 4)) / 3
        : (seconds * 2) / 3 + ((pct - 0.5) * (seconds * 2)) / 3
      : pct * seconds;
  }
  return {
    pointPos,
    times,
    tangents: new Float32Array(points),
    interval: 1 / points,
    pointsCount: points,
    startTime: 1000,
    finishTime: 1000 + seconds,
    lastTrackedPct: 0.999,
    isCleanLap: true,
  };
};

const emptyFile = (): PitStopModelFile => ({
  version: 1,
  transit: {},
  service: {},
  overrides: {},
  order: [],
});

const context = {
  at: 1,
  build: 'b',
  seriesId: 1,
  trackId: 10,
  carId: 20,
  carClassId: 30,
  ruleSet: 'default',
};

const transit = (
  overrides: Partial<PitTransitSample> = {}
): PitTransitSample => ({
  ...context,
  source: 'opponent',
  pitSpeedLimitKph: 60,
  entryPct: 0.9,
  exitPct: 0.05,
  windowSeconds: 60,
  stationarySeconds: 25,
  referenceSeconds: 15,
  windowStartPct: 0.88,
  windowEndPct: 0.08,
  ...overrides,
});

const service = (
  overrides: Partial<PitServiceSample> = {}
): PitServiceSample => ({
  ...context,
  serviceSeconds: 44,
  fuelAddedLitres: 60,
  fuelSeconds: 24,
  tankLitres: 100,
  tankPct: 1,
  tyresChanged: 0b1111,
  repairSeconds: 0,
  fastRepair: false,
  tearOff: false,
  ...overrides,
});

describe('median', () => {
  it('handles odd, even and empty input', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('reference lap lookups', () => {
  const lap = referenceLap(90, 100, true);

  it('reads time at a position, slow half first', () => {
    expect(timeAtPct(lap, 0.25)).toBeCloseTo(30);
    expect(timeAtPct(lap, 0.75)).toBeCloseTo(75);
  });

  it('inverts time back to position', () => {
    expect(pctAtTime(lap, 30)).toBeCloseTo(0.25);
    expect(pctAtTime(lap, 75)).toBeCloseTo(0.75);
    expect(pctAtTime(lap, -15)).toBeCloseTo(0.75);
  });

  it('measures spans across start/finish', () => {
    expect(spanSeconds(lap, 0.75, 0.25)).toBeCloseTo(45);
  });
});

describe('resolveLaneLoss', () => {
  const base = {
    trackId: 10,
    carId: 20,
    carClassId: 30,
    reference: referenceLap(),
    entryPct: 0.9,
    exitPct: 0.05,
    trackLengthMetres: 5000,
    pitSpeedLimitKph: 60,
  };

  it('prefers samples for the same track and car', () => {
    const file = emptyFile();
    file.transit['10:20'] = [transit({ windowSeconds: 60 })];
    file.transit['10:21'] = [transit({ carId: 21, windowSeconds: 80 })];
    const result = resolveLaneLoss({ ...base, file });
    expect(result).toMatchObject({ seconds: 20, source: 'learnedCar' });
  });

  it('falls back to the same class, then any car at the track', () => {
    const file = emptyFile();
    file.transit['10:21'] = [transit({ carId: 21, windowSeconds: 62 })];
    file.transit['10:22'] = [
      transit({ carId: 22, carClassId: 31, windowSeconds: 70 }),
    ];
    expect(resolveLaneLoss({ ...base, file })).toMatchObject({
      seconds: 22,
      source: 'learnedClass',
    });
    expect(resolveLaneLoss({ ...base, file, carClassId: 99 })?.source).toBe(
      'learnedTrack'
    );
  });

  it('uses the median of the five newest samples, so one bad stop does not skew it', () => {
    const file = emptyFile();
    file.transit['10:20'] = [
      transit({ at: 1, windowSeconds: 200 }),
      transit({ at: 2, windowSeconds: 60 }),
      transit({ at: 3, windowSeconds: 61 }),
      transit({ at: 4, windowSeconds: 59 }),
      transit({ at: 5, windowSeconds: 90 }),
      transit({ at: 6, windowSeconds: 60 }),
    ];
    expect(resolveLaneLoss({ ...base, file })?.seconds).toBe(20);
  });

  it('does not learn from long stops, where the car is usually damaged', () => {
    const file = emptyFile();
    file.transit['10:20'] = [
      transit({ at: 1, windowSeconds: 60 }),
      transit({ at: 2, windowSeconds: 466, stationarySeconds: 417 }),
    ];
    const result = resolveLaneLoss({ ...base, file });
    expect(result?.seconds).toBe(20);
    expect(result?.farSeconds).toBe(21);
  });

  it('fills a missing reference time from the current reference lap', () => {
    const file = emptyFile();
    file.transit['10:20'] = [transit({ referenceSeconds: null })];
    // 0.88 to 0.08 is 0.2 of a 90 s lap at even pace.
    expect(resolveLaneLoss({ ...base, file })?.seconds).toBeCloseTo(17);
  });

  it('models the loss when nothing has been learned', () => {
    const result = resolveLaneLoss({ ...base, file: emptyFile() });
    // 750 m at 60 km/h = 45 s, minus 13.5 s on track, plus 6 s allowance.
    expect(result).toMatchObject({ source: 'model' });
    expect(result?.seconds).toBeCloseTo(37.5);
  });

  it('refuses a lane longer than a quarter lap', () => {
    expect(
      modelLaneLoss({ ...base, file: emptyFile(), entryPct: 0.5, exitPct: 0.9 })
    ).toBeNull();
  });
});

describe('resolveServiceRule and serviceSeconds', () => {
  const base = {
    ruleSet: 'default',
    carId: 20,
    carClassId: 30,
    carPath: 'ferrari296gt3',
    tankLitres: 100,
  };
  const request = { fuelLitres: 60, tyres: 4, repairSeconds: 0 };

  it('adds overhead, fuel and tyres under default rules (2.5 + 24 + 20)', () => {
    const resolved = resolveServiceRule({ ...base, file: emptyFile() });
    expect(resolved).toMatchObject({
      tableRow: 'gt3',
      fuelRateSource: 'table',
      overheadSource: 'generic',
    });
    expect(serviceSeconds(resolved.rule, request)).toBeCloseTo(46.5);
  });

  it('overlaps fuel and tyres under IMSA and DTM', () => {
    const imsa = resolveServiceRule({
      ...base,
      ruleSet: 'imsa',
      file: emptyFile(),
    });
    expect(serviceSeconds(imsa.rule, request)).toBeCloseTo(26.5);
    const dtm = resolveServiceRule({
      ...base,
      ruleSet: 'dtm',
      file: emptyFile(),
    });
    expect(serviceSeconds(dtm.rule, request)).toBeCloseTo(26.5);
  });

  it('adds repairs after the service', () => {
    const resolved = resolveServiceRule({ ...base, file: emptyFile() });
    expect(
      serviceSeconds(resolved.rule, { ...request, repairSeconds: 10 })
    ).toBeCloseTo(56.5);
  });

  it('adds nothing for a drive-through with no service', () => {
    const resolved = resolveServiceRule({ ...base, file: emptyFile() });
    expect(
      serviceSeconds(resolved.rule, {
        fuelLitres: 0,
        tyres: 0,
        repairSeconds: 0,
      })
    ).toBe(0);
  });

  it('learns the overhead from a fuel-only stop', () => {
    const file = emptyFile();
    // Stopped 9.6 s, fuelling 6.9 s of it: 2.7 s waiting at either end.
    file.service['default:20'] = [
      service({
        tyresChanged: 0,
        fuelAddedLitres: 17,
        fuelSeconds: 6.9,
        serviceSeconds: 8.5,
        stationarySeconds: 9.6,
      }),
    ];
    const resolved = resolveServiceRule({ ...base, file });
    expect(resolved.overheadSource).toBe('learnedCar');
    expect(resolved.rule.overheadSeconds).toBeCloseTo(2.7);
    expect(
      serviceSeconds(resolved.rule, {
        fuelLitres: 17,
        tyres: 0,
        repairSeconds: 0,
      })
    ).toBeCloseTo(9.6);
  });

  it('learns tyre time net of the overhead when the time stopped is known', () => {
    const file = emptyFile();
    file.service['default:20'] = [
      service({
        at: 1,
        tyresChanged: 0,
        fuelAddedLitres: 20,
        fuelSeconds: 10,
        stationarySeconds: 13,
      }),
      service({
        at: 2,
        fuelAddedLitres: 60,
        fuelSeconds: 30,
        serviceSeconds: 50,
        stationarySeconds: 51,
      }),
    ];
    const resolved = resolveServiceRule({ ...base, file });
    expect(resolved.rule.overheadSeconds).toBeCloseTo(3);
    // 51 stopped, minus 3 overhead, minus 30 fuelling.
    expect(resolved.rule.fourTyreSeconds).toBeCloseTo(18);
  });

  it('learns tyre time from service time on older samples', () => {
    const file = emptyFile();
    file.service['default:20'] = [
      service({ fuelAddedLitres: 60, fuelSeconds: 30, serviceSeconds: 48 }),
    ];
    const resolved = resolveServiceRule({ ...base, file });
    expect(resolved.fuelRateSource).toBe('learnedCar');
    expect(resolved.rule.fuelLitresPerSecond).toBeCloseTo(2);
    expect(resolved.tyreSource).toBe('learnedCar');
    expect(resolved.rule.fourTyreSeconds).toBeCloseTo(18);
    expect(resolved.overheadSource).toBe('generic');
  });

  it('keeps the table tyre time under simultaneous rules when fuel finished last', () => {
    const file = emptyFile();
    file.service['imsa:20'] = [
      service({ ruleSet: 'imsa', fuelSeconds: 24, serviceSeconds: 24.5 }),
    ];
    const resolved = resolveServiceRule({ ...base, ruleSet: 'imsa', file });
    expect(resolved.tyreSource).toBe('table');
    expect(resolved.rule.fourTyreSeconds).toBe(20);
  });

  it('applies hand-edited overrides last', () => {
    const file = emptyFile();
    file.service['default:20'] = [service()];
    file.overrides['default:20'] = { fourTyreSeconds: 12, overheadSeconds: 1 };
    const resolved = resolveServiceRule({ ...base, file });
    expect(resolved.tyreSource).toBe('override');
    expect(resolved.rule.fourTyreSeconds).toBe(12);
    expect(resolved.overheadSource).toBe('override');
    expect(resolved.rule.overheadSeconds).toBe(1);
  });

  it('uses a generic rule with a wide band for a car not in the table', () => {
    const resolved = resolveServiceRule({
      ...base,
      carPath: 'dallarail15',
      file: emptyFile(),
    });
    expect(resolved.fuelRateSource).toBe('generic');
    const estimate = serviceEstimate(resolved, request);
    // 8 s for a generic rate, plus 1 s for an unlearned overhead.
    expect(estimate.farSeconds - estimate.seconds).toBe(9);
  });
});

describe('tyreCount', () => {
  it('counts the four tyre bits only', () => {
    expect(tyreCount(0b1111)).toBe(4);
    expect(tyreCount(0b0011)).toBe(2);
    expect(tyreCount(0b1110000)).toBe(0);
  });
});

describe('rejoinOffset', () => {
  it('steps back along the reference lap', () => {
    const lap = referenceLap(90, 100, true);
    // At 0.75 the player is 75 s into the lap; 30 s earlier is 0.375.
    expect(rejoinOffset(0.75, 30, lap, null)).toEqual({
      offsetPct: expect.closeTo(0.375, 3),
      lapsLost: 0,
    });
  });

  it('wraps back across start/finish', () => {
    const lap = referenceLap(90);
    const result = rejoinOffset(0.1, 27, lap, null);
    expect(result?.offsetPct).toBeCloseTo(0.3);
  });

  it('counts whole laps lost on very long stops', () => {
    const result = rejoinOffset(0.5, 200, referenceLap(90), null);
    expect(result?.lapsLost).toBe(2);
    expect(result?.offsetPct).toBeCloseTo(20 / 90);
  });

  it('assumes even pace without a reference lap', () => {
    expect(rejoinOffset(0.5, 45, null, 90)).toEqual({
      offsetPct: 0.5,
      lapsLost: 0,
    });
    expect(rejoinOffset(0.5, 45, null, null)).toBeNull();
  });
});

describe('nearestAround', () => {
  it('finds the closest car each side, across start/finish', () => {
    const pcts = [0.95, 0.5, 0.1, -1, 0.02];
    expect(nearestAround(0.0, pcts, () => true)).toEqual({
      ahead: 4,
      behind: 0,
    });
  });

  it('skips excluded cars', () => {
    const pcts = [0.95, 0.5, 0.1, -1, 0.02];
    expect(nearestAround(0.0, pcts, (idx) => idx !== 4)).toEqual({
      ahead: 2,
      behind: 0,
    });
  });
});

describe('fuelStopNeeded', () => {
  const lap = (
    fuelUsed: number,
    extra: Partial<FuelLapData> = {}
  ): FuelLapData => ({
    lapNumber: 1,
    fuelUsed,
    lapTime: 90,
    isGreenFlag: true,
    isValidForCalc: true,
    isOutLap: false,
    timestamp: 0,
    ...extra,
  });

  it('compares fuel on board with laps left times median usage', () => {
    const laps = [lap(3), lap(3.2), lap(2.8)];
    expect(fuelStopNeeded(20, 10, true, laps)).toBe(true);
    expect(fuelStopNeeded(31, 10, true, laps)).toBe(false);
  });

  it('ignores out laps, caution laps and invalid laps', () => {
    const laps = [
      lap(9, { isOutLap: true }),
      lap(9, { isGreenFlag: false }),
      lap(3),
      lap(3),
    ];
    expect(fuelStopNeeded(31, 10, true, laps)).toBe(false);
  });

  it('is unknown without a race estimate or enough laps', () => {
    expect(fuelStopNeeded(20, 10, false, [lap(3), lap(3)])).toBeNull();
    expect(fuelStopNeeded(20, 10, true, [lap(3)])).toBeNull();
  });
});
