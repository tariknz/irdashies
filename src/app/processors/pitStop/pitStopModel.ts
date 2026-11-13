import type {
  FuelLapData,
  PitEstimateSource,
  PitRuleFamily,
  PitServiceRule,
  PitServiceSample,
  PitStopModelFile,
  PitTransitSample,
  ReferenceLap,
} from '@irdashies/types';
import {
  DEFAULT_STOP_OVERHEAD_SECONDS,
  resolveTableRule,
  ruleFamilyFromTag,
} from './pitServiceRules';

/** Estimates use the median of this many most recent samples. */
export const RECENT_SAMPLES = 5;
const ALL_TYRES = 0b1111;

/** Half-widths of the uncertainty band, in seconds, by source. */
const SPREAD_SECONDS: Record<PitEstimateSource, number> = {
  override: 0.5,
  learnedCar: 1,
  learnedClass: 2,
  learnedTrack: 3,
  table: 2,
  tableDefault: 3,
  model: 5,
  generic: 8,
  none: 0,
};

/** Braking into and accelerating out of the lane, and in and out of the box. */
export const LANE_MODEL_ALLOWANCE_SECONDS = 6;
const GENERIC_FULL_TANK_SECONDS = 40;
const GENERIC_FOUR_TYRE_SECONDS = 20;
const DEFAULT_OVERHEAD_SPREAD_SECONDS = 1;
const LEARNED_OVERHEAD_SPREAD_SECONDS = 0.5;
/** Longer stops are usually repairs, with the car driven slowly; not learned. */
export const MAX_LANE_SAMPLE_STATIONARY_SECONDS = 60;
/** Lanes longer than this fraction of a lap are treated as bad detections. */
export const MAX_LANE_FRACTION = 0.25;

export const transitKey = (trackId: number, carId: number) =>
  `${trackId}:${carId}`;
export const serviceKey = (ruleSet: string, carId: number) =>
  `${ruleSet}:${carId}`;

export const median = (values: readonly number[]): number | null => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
};

const wrap01 = (value: number) => ((value % 1) + 1) % 1;

/** Forward distance from `from` to `to`, as a lap fraction in [0, 1). */
export const forwardPct = (from: number, to: number) => wrap01(to - from);

/** Median of lap positions, correct when they straddle start/finish. */
export const circularMedian = (values: readonly number[]): number | null => {
  if (values.length === 0) return null;
  const anchor = values[0];
  const offsets = values.map((value) => {
    const offset = wrap01(value - anchor);
    return offset > 0.5 ? offset - 1 : offset;
  });
  return wrap01(anchor + (median(offsets) as number));
};

/** "5.51 km" or "3.42 mi" to metres; 0 when unreadable. */
export const parseTrackLengthMetres = (value: string | undefined): number => {
  const [amount, unit] = (value ?? '').trim().split(/\s+/);
  const parsed = Number.parseFloat(amount);
  if (!Number.isFinite(parsed)) return 0;
  if (unit === 'km') return parsed * 1000;
  if (unit === 'mi') return parsed * 1609.344;
  return parsed;
};

/** "60.00 kph" or "35.00 mph" to km/h; 0 when unreadable. */
export const parseSpeedKph = (value: string | undefined): number => {
  const [amount, unit] = (value ?? '').trim().split(/\s+/);
  const parsed = Number.parseFloat(amount);
  if (!Number.isFinite(parsed)) return 0;
  return unit === 'mph' ? parsed * 1.609344 : parsed;
};

const recent = <T extends { at: number }>(samples: readonly T[]) =>
  [...samples].sort((a, b) => b.at - a.at).slice(0, RECENT_SAMPLES);

// ---------------------------------------------------------------------------
// Reference lap lookups

export const lapSeconds = (lap: ReferenceLap) => lap.finishTime - lap.startTime;

/** Seconds into the lap at which the reference car reached `pct`. */
export const timeAtPct = (lap: ReferenceLap, pct: number): number | null => {
  const total = lapSeconds(lap);
  if (!(total > 0) || lap.pointsCount <= 0) return null;
  const target = wrap01(pct);

  let lowerPos = 0;
  let lowerTime = 0;
  let upperPos = 1;
  let upperTime = total;
  for (let i = 0; i < lap.pointsCount; i++) {
    const pos = lap.pointPos[i];
    if (pos < 0) continue;
    if (pos <= target) {
      lowerPos = pos;
      lowerTime = lap.times[i];
    } else {
      upperPos = pos;
      upperTime = lap.times[i];
      break;
    }
  }
  if (upperPos <= lowerPos) return lowerTime;
  const ratio = (target - lowerPos) / (upperPos - lowerPos);
  return lowerTime + ratio * (upperTime - lowerTime);
};

/** Reference time to drive forward from `from` to `to`. */
export const spanSeconds = (
  lap: ReferenceLap,
  from: number,
  to: number
): number | null => {
  const total = lapSeconds(lap);
  const a = timeAtPct(lap, from);
  const b = timeAtPct(lap, to);
  if (a === null || b === null || !(total > 0)) return null;
  const span = b - a;
  return span >= 0 ? span : span + total;
};

/** Position the reference car had reached `seconds` into the lap. */
export const pctAtTime = (
  lap: ReferenceLap,
  seconds: number
): number | null => {
  const total = lapSeconds(lap);
  if (!(total > 0)) return null;
  const target = ((seconds % total) + total) % total;

  let lowerPos = 0;
  let lowerTime = 0;
  let upperPos = 1;
  let upperTime = total;
  for (let i = 0; i < lap.pointsCount; i++) {
    const pos = lap.pointPos[i];
    if (pos < 0) continue;
    const time = lap.times[i];
    if (time <= target) {
      lowerPos = pos;
      lowerTime = time;
    } else {
      upperPos = pos;
      upperTime = time;
      break;
    }
  }
  if (upperTime <= lowerTime) return lowerPos;
  const ratio = (target - lowerTime) / (upperTime - lowerTime);
  return wrap01(lowerPos + ratio * (upperPos - lowerPos));
};

// ---------------------------------------------------------------------------
// Lane loss

export interface LaneLossInput {
  file: PitStopModelFile;
  trackId: number;
  carId: number;
  carClassId: number;
  /** Fills in samples recorded before a reference lap existed. */
  reference: ReferenceLap | null;
  entryPct: number | null;
  exitPct: number | null;
  trackLengthMetres: number;
  pitSpeedLimitKph: number;
}

export interface Estimate {
  seconds: number;
  nearSeconds: number;
  farSeconds: number;
  source: PitEstimateSource;
}

const transitLoss = (
  sample: PitTransitSample,
  reference: ReferenceLap | null
): number | null => {
  const referenceSeconds =
    sample.referenceSeconds ??
    (reference
      ? spanSeconds(reference, sample.windowStartPct, sample.windowEndPct)
      : null);
  if (referenceSeconds === null) return null;
  return sample.windowSeconds - sample.stationarySeconds - referenceSeconds;
};

const fromLosses = (
  losses: readonly number[],
  source: PitEstimateSource
): Estimate | null => {
  const mid = median(losses);
  if (mid === null) return null;
  const spread = Math.max(
    SPREAD_SECONDS[source],
    (Math.max(...losses) - Math.min(...losses)) / 2
  );
  return {
    seconds: mid,
    nearSeconds: mid - spread,
    farSeconds: mid + spread,
    source,
  };
};

const lossesFrom = (
  samples: readonly PitTransitSample[],
  reference: ReferenceLap | null
) =>
  recent(
    samples.filter(
      (sample) => sample.stationarySeconds <= MAX_LANE_SAMPLE_STATIONARY_SECONDS
    )
  )
    .map((sample) => transitLoss(sample, reference))
    .filter((loss): loss is number => loss !== null);

export const resolveLaneLoss = (input: LaneLossInput): Estimate | null => {
  const { file, trackId, carId, carClassId, reference } = input;

  const own = lossesFrom(
    file.transit[transitKey(trackId, carId)] ?? [],
    reference
  );
  if (own.length > 0) return fromLosses(own, 'learnedCar');

  const prefix = `${trackId}:`;
  const sameTrack: PitTransitSample[] = [];
  for (const [key, samples] of Object.entries(file.transit)) {
    if (key.startsWith(prefix)) sameTrack.push(...samples);
  }
  const sameClass = lossesFrom(
    sameTrack.filter((sample) => sample.carClassId === carClassId),
    reference
  );
  if (sameClass.length > 0) return fromLosses(sameClass, 'learnedClass');
  const anyCar = lossesFrom(sameTrack, reference);
  if (anyCar.length > 0) return fromLosses(anyCar, 'learnedTrack');

  return modelLaneLoss(input);
};

export const modelLaneLoss = (input: LaneLossInput): Estimate | null => {
  const { entryPct, exitPct, reference, trackLengthMetres, pitSpeedLimitKph } =
    input;
  if (entryPct === null || exitPct === null || !reference) return null;
  if (!(trackLengthMetres > 0) || !(pitSpeedLimitKph > 0)) return null;
  const fraction = forwardPct(entryPct, exitPct);
  if (fraction <= 0 || fraction > MAX_LANE_FRACTION) return null;
  const onTrack = spanSeconds(reference, entryPct, exitPct);
  if (onTrack === null) return null;
  const inLane = (fraction * trackLengthMetres) / (pitSpeedLimitKph / 3.6);
  const seconds = inLane - onTrack + LANE_MODEL_ALLOWANCE_SECONDS;
  return {
    seconds,
    nearSeconds: seconds - SPREAD_SECONDS.model,
    farSeconds: seconds + SPREAD_SECONDS.model,
    source: 'model',
  };
};

// ---------------------------------------------------------------------------
// Service

export interface ServiceRuleInput {
  file: PitStopModelFile;
  ruleSet: string;
  carId: number;
  carClassId: number;
  carPath: string;
  tankLitres: number;
}

export interface ResolvedServiceRule {
  rule: PitServiceRule;
  fuelRateSource: PitEstimateSource;
  tyreSource: PitEstimateSource;
  overheadSource: PitEstimateSource;
  tableRow: string | null;
  family: PitRuleFamily;
}

const learnedFuelRate = (samples: readonly PitServiceSample[]) =>
  median(
    recent(
      samples.filter(
        (sample) =>
          sample.fuelSeconds !== null &&
          sample.fuelSeconds > 0 &&
          sample.fuelAddedLitres > 1
      )
    ).map((sample) => sample.fuelAddedLitres / (sample.fuelSeconds as number))
  );

/**
 * The fixed time per stop, from fuel-only stops: time stopped minus fuelling
 * and repairs. Stops with tyres cannot separate it from tyre time.
 */
const learnedOverhead = (samples: readonly PitServiceSample[]) =>
  median(
    recent(
      samples.filter(
        (sample) =>
          sample.stationarySeconds !== undefined &&
          sample.tyresChanged === 0 &&
          sample.fuelSeconds !== null &&
          sample.fuelSeconds > 0
      )
    )
      .map(
        (sample) =>
          (sample.stationarySeconds as number) -
          (sample.fuelSeconds as number) -
          sample.repairSeconds
      )
      .filter((value) => value >= 0)
  );

/**
 * Four-tyre time from stops where all four were changed, net of the fixed
 * overhead when the time stopped is known. Under simultaneous rules it is
 * only visible when tyres finished after fuel.
 */
const learnedTyreSeconds = (
  samples: readonly PitServiceSample[],
  sequencing: PitServiceRule['sequencing'],
  overheadSeconds: number
) =>
  median(
    recent(samples.filter((sample) => sample.tyresChanged === ALL_TYRES))
      .map((sample) => {
        const working =
          sample.stationarySeconds !== undefined
            ? sample.stationarySeconds - overheadSeconds - sample.repairSeconds
            : sample.serviceSeconds - sample.repairSeconds;
        const fuel = sample.fuelSeconds ?? 0;
        if (sequencing === 'fuelThenTyres') return working - fuel;
        return working > fuel + 1 ? working : null;
      })
      .filter((value): value is number => value !== null && value > 0)
  );

export const resolveServiceRule = (
  input: ServiceRuleInput
): ResolvedServiceRule => {
  const { file, ruleSet, carId, carClassId, carPath, tankLitres } = input;
  const requested = ruleFamilyFromTag(ruleSet);
  const table = resolveTableRule(carPath, requested, tankLitres);

  const rule: PitServiceRule = table?.rule ?? {
    fuelLitresPerSecond:
      tankLitres > 0 ? tankLitres / GENERIC_FULL_TANK_SECONDS : 2,
    fourTyreSeconds: GENERIC_FOUR_TYRE_SECONDS,
    sequencing: requested === 'default' ? 'fuelThenTyres' : 'simultaneous',
    overheadSeconds: DEFAULT_STOP_OVERHEAD_SECONDS,
  };
  let fuelRateSource: PitEstimateSource = table?.source ?? 'generic';
  let tyreSource: PitEstimateSource = table?.source ?? 'generic';
  let overheadSource: PitEstimateSource = 'generic';

  const own = file.service[serviceKey(ruleSet, carId)] ?? [];
  const prefix = `${ruleSet}:`;
  const sameClass: PitServiceSample[] = [];
  for (const [key, samples] of Object.entries(file.service)) {
    if (!key.startsWith(prefix)) continue;
    sameClass.push(...samples.filter((s) => s.carClassId === carClassId));
  }

  const ownRate = learnedFuelRate(own);
  const classRate = ownRate === null ? learnedFuelRate(sameClass) : null;
  if (ownRate !== null) {
    rule.fuelLitresPerSecond = ownRate;
    fuelRateSource = 'learnedCar';
  } else if (classRate !== null) {
    rule.fuelLitresPerSecond = classRate;
    fuelRateSource = 'learnedClass';
  }

  const override = file.overrides[serviceKey(ruleSet, carId)];

  const ownOverhead = learnedOverhead(own);
  const classOverhead =
    ownOverhead === null ? learnedOverhead(sameClass) : null;
  if (ownOverhead !== null) {
    rule.overheadSeconds = ownOverhead;
    overheadSource = 'learnedCar';
  } else if (classOverhead !== null) {
    rule.overheadSeconds = classOverhead;
    overheadSource = 'learnedClass';
  }
  if (override?.overheadSeconds !== undefined) {
    rule.overheadSeconds = override.overheadSeconds;
    overheadSource = 'override';
  }

  const ownTyres = learnedTyreSeconds(
    own,
    rule.sequencing,
    rule.overheadSeconds
  );
  const classTyres =
    ownTyres === null
      ? learnedTyreSeconds(sameClass, rule.sequencing, rule.overheadSeconds)
      : null;
  if (ownTyres !== null) {
    rule.fourTyreSeconds = ownTyres;
    tyreSource = 'learnedCar';
  } else if (classTyres !== null) {
    rule.fourTyreSeconds = classTyres;
    tyreSource = 'learnedClass';
  }

  if (override?.fuelLitresPerSecond !== undefined) {
    rule.fuelLitresPerSecond = override.fuelLitresPerSecond;
    fuelRateSource = 'override';
  }
  if (override?.fourTyreSeconds !== undefined) {
    rule.fourTyreSeconds = override.fourTyreSeconds;
    tyreSource = 'override';
  }
  if (override?.sequencing !== undefined) rule.sequencing = override.sequencing;

  return {
    rule,
    fuelRateSource,
    tyreSource,
    overheadSource,
    tableRow: table?.rowId ?? null,
    family: table?.family ?? requested,
  };
};

export interface ServiceRequest {
  fuelLitres: number;
  tyres: number;
  repairSeconds: number;
}

const requestsService = (request: ServiceRequest) =>
  request.fuelLitres > 0 || request.tyres > 0 || request.repairSeconds > 0;

/** Time stopped in the box: the fixed overhead plus the work. */
export const serviceSeconds = (
  rule: PitServiceRule,
  request: ServiceRequest
): number => {
  if (!requestsService(request)) return 0;
  const fuel =
    request.fuelLitres > 0 && rule.fuelLitresPerSecond > 0
      ? request.fuelLitres / rule.fuelLitresPerSecond
      : 0;
  const tyres =
    (Math.min(4, Math.max(0, request.tyres)) / 4) * rule.fourTyreSeconds;
  const repair = Math.max(0, request.repairSeconds);
  const work =
    rule.sequencing === 'simultaneous'
      ? Math.max(fuel, tyres) + repair
      : fuel + tyres + repair;
  return rule.overheadSeconds + work;
};

export const serviceEstimate = (
  resolved: ResolvedServiceRule,
  request: ServiceRequest
): Estimate => {
  const seconds = serviceSeconds(resolved.rule, request);
  const usesFuel = request.fuelLitres > 0;
  const usesTyres = request.tyres > 0;
  const overheadSpread = !requestsService(request)
    ? 0
    : resolved.overheadSource === 'generic'
      ? DEFAULT_OVERHEAD_SPREAD_SECONDS
      : LEARNED_OVERHEAD_SPREAD_SECONDS;
  const spread =
    Math.max(
      usesFuel ? SPREAD_SECONDS[resolved.fuelRateSource] : 0,
      usesTyres ? SPREAD_SECONDS[resolved.tyreSource] : 0
    ) + overheadSpread;
  const source =
    usesFuel || !usesTyres ? resolved.fuelRateSource : resolved.tyreSource;
  return {
    seconds,
    nearSeconds: Math.max(0, seconds - spread),
    farSeconds: seconds + spread,
    source,
  };
};

export const tyreCount = (pitSvFlags: number) => {
  let count = 0;
  for (let bit = 0; bit < 4; bit++) if (pitSvFlags & (1 << bit)) count++;
  return count;
};

// ---------------------------------------------------------------------------
// Rejoin point

export interface RejoinOffset {
  /** Fraction of a lap behind the player, whole laps removed. */
  offsetPct: number;
  lapsLost: number;
}

/**
 * Where the player would be `lossSeconds` ago on the reference lap. Other
 * cars are assumed to keep the reference pace, so that is also where the
 * player rejoins relative to traffic.
 */
export const rejoinOffset = (
  playerPct: number,
  lossSeconds: number,
  reference: ReferenceLap | null,
  fallbackLapSeconds: number | null
): RejoinOffset | null => {
  const total = reference ? lapSeconds(reference) : (fallbackLapSeconds ?? 0);
  if (!(total > 0) || !Number.isFinite(lossSeconds)) return null;
  const loss = Math.max(0, lossSeconds);
  const lapsLost = Math.floor(loss / total);
  const remainder = loss - lapsLost * total;

  if (!reference) return { offsetPct: remainder / total, lapsLost };

  const now = timeAtPct(reference, playerPct);
  if (now === null) return null;
  const then = pctAtTime(reference, now - remainder);
  if (then === null) return null;
  return { offsetPct: forwardPct(then, playerPct), lapsLost };
};

/** Nearest cars ahead of and behind `pct`, by lap position only. */
export const nearestAround = (
  pct: number,
  carPcts: readonly number[],
  include: (carIdx: number) => boolean
): { ahead: number | null; behind: number | null } => {
  let ahead: number | null = null;
  let behind: number | null = null;
  let aheadGap = Infinity;
  let behindGap = Infinity;
  for (let carIdx = 0; carIdx < carPcts.length; carIdx++) {
    const carPct = carPcts[carIdx];
    if (!(carPct >= 0) || !include(carIdx)) continue;
    const forward = forwardPct(pct, carPct);
    const backward = forwardPct(carPct, pct);
    if (forward > 0 && forward < aheadGap) {
      aheadGap = forward;
      ahead = carIdx;
    }
    if (backward > 0 && backward < behindGap) {
      behindGap = backward;
      behind = carIdx;
    }
  }
  return { ahead, behind };
};

// ---------------------------------------------------------------------------
// Fuel stop needed

const MIN_FUEL_LAPS = 2;

/**
 * True when the fuel on board will not last the laps left, using the median
 * usage of recent green, valid laps. No margin or trend, unlike the Fuel
 * Calculator. `laps` is newest first, as in the fuel projection snapshot.
 * Null when there is not enough data to say.
 */
export const fuelStopNeeded = (
  fuelLevel: number,
  estimatedLapsRemaining: number,
  hasValidRaceEstimate: boolean,
  laps: readonly FuelLapData[]
): boolean | null => {
  if (!hasValidRaceEstimate || !(estimatedLapsRemaining >= 0)) return null;
  const usage = laps
    .filter(
      (lap) =>
        lap.isValidForCalc &&
        lap.isGreenFlag &&
        !lap.isOutLap &&
        !lap.isInLap &&
        lap.fuelUsed > 0
    )
    .slice(0, RECENT_SAMPLES)
    .map((lap) => lap.fuelUsed);
  if (usage.length < MIN_FUEL_LAPS) return null;
  const perLap = median(usage) as number;
  return fuelLevel < estimatedLapsRemaining * perLap;
};
