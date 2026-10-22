import type {
  RacePlanConditions,
  RacePlanDriverFigures,
  RacePlanProjectedStint,
  RacePlanStint,
  RacePlanStrategy,
} from '@irdashies/types';

/**
 * Rebuilds the rest of a race plan from where the team car really is.
 *
 * A stint is one tank of fuel. Done and current stints come from what
 * happened; later stints keep the plan's driver order, and each is one full
 * tank at the measured fuel use and pace. Stints are fitted to the race time
 * left: an extra stint the plan has no driver for is `unassigned`, a planned
 * stint that no longer fits is `dropped`.
 *
 * Pure and deterministic: the processor decides when to call it.
 */

export interface RebaselineActualStint {
  /** iRacing customer id of the driver, when known. */
  driverId: number | null;
  /** Team lap the stint started on. */
  startLap: number;
  /** Race elapsed seconds. */
  startSec: number;
  /** Null for the current stint. */
  endLap: number | null;
  endSec: number | null;
  /**
   * Index of the plan stint this one stands for. A stint split by an
   * unplanned fuel stop shares its plan stint's index.
   */
  planIndex: number;
  /**
   * Began with fuel added (or at the race start). False for a driver swap with
   * no fuel, which carries on the previous tank.
   */
  fueled: boolean;
}

export interface RebaselineInput {
  strategy: RacePlanStrategy;
  /**
   * What happened, in order. The last entry is the current stint (no end)
   * once the race is green; empty before.
   */
  actual: readonly RebaselineActualStint[];
  /** Laps completed by the team car. */
  teamLaps: number;
  /** Race elapsed seconds now. */
  elapsedSec: number;
  /** Seconds of racing left; null when unknown (the plan's end is used). */
  remainingSec: number | null;
  /** Litres in the car now; null when not visible. */
  fuelLevel: number | null;
  /** Litres a full tank holds; null to use the plan's fuel capacity. */
  tankCapacity: number | null;
  /** Measured litres per lap in the current conditions, when settled. */
  fuelPerLap: number | null;
  /** Measured lap time in seconds in the current conditions, when settled. */
  lapTimeSec: number | null;
  conditions: RacePlanConditions;
}

export interface RebaselineResult {
  stints: RacePlanProjectedStint[];
  /**
   * Team lap to box on for the current stint. Null before green, and null
   * when the current stint runs to the finish (no stop needed).
   */
  boxLap: number | null;
  /** Actual minus planned elapsed time at `teamLaps`; null before green. */
  driftSec: number | null;
}

export const MAX_PROJECTED_STINTS = 200;

/** A lap is only counted on fuel if it leaves at least this many laps spare. */
export const FUEL_MARGIN_LAPS = 0.3;

const DEFAULT_LAP_SEC = 120;
const DEFAULT_STINT_LAPS = 30;
const EPS = 1e-6;
/** Laps; absorbs rounding when fitting the last stint to the race end. */
const FIT_EPS = 0.01;

const positive = (value: number | null | undefined): number | null =>
  typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null;

const finiteOr = (value: number | null | undefined, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? value : fallback;

const round2 = (value: number) => Math.round(value * 100) / 100;

/** Whole laps a fuel load covers, keeping `FUEL_MARGIN_LAPS` in hand. */
export const lapsOnFuel = (fuel: number, fuelPerLap: number): number =>
  Math.max(0, Math.floor(fuel / fuelPerLap - FUEL_MARGIN_LAPS + EPS));

interface Context {
  plan: readonly RacePlanStint[];
  /** Team lap each plan stint starts on. */
  planStartLaps: number[];
  figures: Map<number, RacePlanDriverFigures>;
  conditions: RacePlanConditions;
  capacity: number | null;
  measuredFuelPerLap: number | null;
  measuredLapSec: number | null;
  /** Measured lap ÷ plan pace of the stint it was measured in; 1 if unknown. */
  paceFactor: number;
  pitSec: number;
  fallbackLapSec: number;
  fallbackLaps: number;
}

const buildContext = (input: RebaselineInput): Context => {
  const plan = input.strategy.stints.slice(0, MAX_PROJECTED_STINTS);
  const planStartLaps: number[] = [];
  let laps = 0;
  let duration = 0;
  let maxLaps = 0;
  for (const stint of plan) {
    planStartLaps.push(laps);
    const stintLaps = Math.max(0, stint.laps);
    laps += stintLaps;
    if (stintLaps > 0) duration += stint.endSec - stint.startSec;
    maxLaps = Math.max(maxLaps, stintLaps);
  }
  return {
    plan,
    planStartLaps,
    figures: new Map(input.strategy.drivers.map((d) => [d.iracingId, d])),
    conditions: input.conditions,
    capacity:
      positive(input.tankCapacity) ?? positive(input.strategy.fuelCapacity),
    measuredFuelPerLap: positive(input.fuelPerLap),
    measuredLapSec: positive(input.lapTimeSec),
    paceFactor: 1,
    pitSec: (positive(input.strategy.pitStopMs) ?? 0) / 1000,
    fallbackLapSec: positive(duration / laps) ?? DEFAULT_LAP_SEC,
    fallbackLaps: maxLaps > 0 ? maxLaps : DEFAULT_STINT_LAPS,
  };
};

const planAt = (ctx: Context, index: number): RacePlanStint | undefined =>
  index >= 0 ? ctx.plan[index] : undefined;

const planLapSec = (stint: RacePlanStint | undefined): number | null =>
  stint && stint.laps > 0
    ? positive((stint.endSec - stint.startSec) / stint.laps)
    : null;

const driverLapSec = (
  ctx: Context,
  driverId: number | null,
  conditions: RacePlanConditions
): number | null => {
  const figures = driverId === null ? undefined : ctx.figures.get(driverId);
  const ms = positive(
    conditions === 'wet' ? figures?.avgLapMsWet : figures?.avgLapMsDry
  );
  return ms === null ? null : ms / 1000;
};

const driverFuelPerLap = (
  ctx: Context,
  driverId: number | null,
  conditions: RacePlanConditions
): number | null => {
  const figures = driverId === null ? undefined : ctx.figures.get(driverId);
  return positive(
    conditions === 'wet' ? figures?.fuelPerLapWet : figures?.fuelPerLapDry
  );
};

/**
 * The plan's pace for a stint in the current conditions: its own pace while
 * they match its setup, else the driver's figure for them.
 */
const planPaceSec = (
  ctx: Context,
  stint: RacePlanStint | undefined,
  driverId: number | null
): number | null =>
  (stint?.setup === ctx.conditions ? planLapSec(stint) : null) ??
  driverLapSec(ctx, driverId, ctx.conditions);

/**
 * The stint driver's plan pace, scaled by how the measured lap compares with
 * the plan pace of the stint it was measured in. When the driver has no
 * figure for the conditions, the measured lap is used, then dry figures.
 */
const lapSecFor = (
  ctx: Context,
  stint: RacePlanStint | undefined,
  driverId: number | null
): number => {
  const base = planPaceSec(ctx, stint, driverId);
  if (base !== null) return base * ctx.paceFactor;
  return (
    ctx.measuredLapSec ??
    planLapSec(stint) ??
    driverLapSec(ctx, driverId, 'dry') ??
    ctx.fallbackLapSec
  );
};

/** Never assumes the wet uses less fuel: falls back to dry figures. */
const fuelPerLapFor = (
  ctx: Context,
  stint: RacePlanStint | undefined,
  driverId: number | null
): number | null =>
  ctx.measuredFuelPerLap ??
  driverFuelPerLap(ctx, driverId, ctx.conditions) ??
  (stint && stint.laps > 0 ? positive((stint.fuel ?? 0) / stint.laps) : null) ??
  driverFuelPerLap(ctx, driverId, 'dry');

/**
 * Laps in a full stint at plan index `index`: the plan's laps while they
 * still fit in the tank, otherwise what the tank holds. The plan's last stint
 * and extra stints may run as long as the tank allows.
 */
const fullStintLaps = (
  ctx: Context,
  index: number,
  fuelPerLap: number | null
): number => {
  const stint = planAt(ctx, index);
  const tankLaps =
    ctx.capacity !== null && fuelPerLap !== null
      ? Math.max(1, lapsOnFuel(ctx.capacity, fuelPerLap))
      : null;
  const planLaps = stint && stint.laps > 0 ? stint.laps : null;
  const planFits =
    planLaps !== null &&
    (ctx.capacity === null ||
      fuelPerLap === null ||
      planLaps * fuelPerLap <= ctx.capacity + EPS);
  if (planLaps !== null && planFits) {
    const isLast = index >= ctx.plan.length - 1;
    return isLast && tankLaps !== null
      ? Math.max(planLaps, tankLaps)
      : planLaps;
  }
  return tankLaps ?? ctx.fallbackLaps;
};

/** Laps from `fromSec` until the flag, counting the lap in progress. */
const lapsToFinish = (fromSec: number, raceEndSec: number, lapSec: number) =>
  Math.max(1, Math.ceil((raceEndSec - fromSec) / lapSec - FIT_EPS));

const planIndexOf = (stint: RebaselineActualStint, position: number) =>
  Number.isSafeInteger(stint.planIndex) && stint.planIndex >= 0
    ? stint.planIndex
    : position;

const driverOf = (
  stint: RebaselineActualStint,
  planned: RacePlanStint | undefined
): number | null => stint.driverId ?? planned?.driverId ?? null;

/** Stint as it stands in the output, before it is given its position. */
type UnnumberedStint = Omit<RacePlanProjectedStint, 'number'>;

const isRebuilt = (
  ctx: Context,
  index: number,
  startLap: number,
  laps: number
): boolean => {
  const planned = planAt(ctx, index);
  return (
    !planned ||
    ctx.planStartLaps[index] !== startLap ||
    Math.max(0, planned.laps) !== laps
  );
};

const planFields = (ctx: Context, index: number) => {
  const planned = planAt(ctx, index);
  return {
    planNumber: planned ? planned.number : null,
    plannedStartSec: planned ? planned.startSec : null,
    plannedEndSec: planned ? planned.endSec : null,
  };
};

/**
 * Last lap the tank of an unfueled stint (a driver swap with no fuel) was
 * good for: the stint that last took fuel, plus its full-tank laps.
 */
const unfueledTankLimit = (
  ctx: Context,
  actual: readonly RebaselineActualStint[],
  position: number
): number | null => {
  if (position === 0 || actual[position].fueled !== false) return null;
  let k = position - 1;
  while (k > 0 && actual[k].fueled === false) k--;
  const tank = actual[k];
  const index = planIndexOf(tank, k);
  const planned = planAt(ctx, index);
  return (
    tank.startLap +
    fullStintLaps(
      ctx,
      index,
      fuelPerLapFor(ctx, planned, driverOf(tank, planned))
    )
  );
};

/** Planned race elapsed time at a team lap count, including pit time. */
export const plannedElapsedAtLap = (
  strategy: RacePlanStrategy,
  lap: number,
  /** The car has just stopped on this lap: a planned stop is behind it. */
  afterStop = false
): number | null => {
  let startLap = 0;
  let last: RacePlanStint | null = null;
  for (const stint of strategy.stints) {
    if (stint.laps <= 0) continue;
    if (lap <= startLap) return stint.startSec;
    const endLap = startLap + stint.laps;
    if (lap < endLap || (lap === endLap && !afterStop))
      return (
        stint.startSec +
        ((lap - startLap) / stint.laps) * (stint.endSec - stint.startSec)
      );
    startLap += stint.laps;
    last = stint;
  }
  if (!last) return null;
  const lapSec = (last.endSec - last.startSec) / last.laps;
  return last.endSec + (lap - startLap) * lapSec;
};

const numbered = (stints: UnnumberedStint[]): RacePlanProjectedStint[] =>
  stints.map((stint, i) => ({ number: i + 1, ...stint }));

const planAsIs = (ctx: Context): RebaselineResult => ({
  stints: numbered(
    ctx.plan.map((stint, i) => ({
      planNumber: stint.number,
      driverId: stint.driverId,
      plannedStartSec: stint.startSec,
      plannedEndSec: stint.endSec,
      startSec: stint.startSec,
      endSec: stint.endSec,
      startLap: ctx.planStartLaps[i],
      laps: Math.max(0, stint.laps),
      status: stint.driverId === null ? 'unassigned' : 'upcoming',
      setup: stint.setup,
      rebuilt: false,
    }))
  ),
  boxLap: null,
  driftSec: null,
});

export function rebaselinePlan(input: RebaselineInput): RebaselineResult {
  const ctx = buildContext(input);
  const actual = input.actual.slice(0, MAX_PROJECTED_STINTS);
  if (actual.length === 0) return planAsIs(ctx);

  const elapsed = Math.max(0, finiteOr(input.elapsedSec, 0));
  const lastPlan = planAt(ctx, ctx.plan.length - 1);
  const remaining = finiteOr(input.remainingSec, Number.NaN);
  const raceEndSec = Number.isFinite(remaining)
    ? elapsed + Math.max(0, remaining)
    : (lastPlan?.endSec ?? elapsed);

  const lastPosition = actual.length - 1;
  const current = actual[lastPosition];
  const currentIndex = planIndexOf(current, lastPosition);
  const hasCurrent = current.endLap === null && current.endSec === null;
  const doneCount = hasCurrent ? lastPosition : actual.length;
  let teamLaps = Math.max(0, Math.floor(finiteOr(input.teamLaps, 0)));
  if (hasCurrent) teamLaps = Math.max(teamLaps, current.startLap);

  const currentPlanned = planAt(ctx, currentIndex);
  const currentBase = planPaceSec(
    ctx,
    currentPlanned,
    driverOf(current, currentPlanned)
  );
  if (ctx.measuredLapSec !== null && currentBase !== null)
    ctx.paceFactor = ctx.measuredLapSec / currentBase;

  const stints: UnnumberedStint[] = [];

  for (let i = 0; i < doneCount; i++) {
    const stint = actual[i];
    const next = actual[i + 1] as RebaselineActualStint | undefined;
    const index = planIndexOf(stint, i);
    const endLap = stint.endLap ?? next?.startLap ?? teamLaps;
    const endSec = stint.endSec ?? next?.startSec ?? elapsed;
    const laps = Math.max(0, endLap - stint.startLap);
    stints.push({
      ...planFields(ctx, index),
      driverId: stint.driverId,
      startSec: round2(stint.startSec),
      endSec: round2(endSec),
      startLap: stint.startLap,
      laps,
      status: 'done',
      setup: planAt(ctx, index)?.setup ?? ctx.conditions,
      rebuilt: isRebuilt(ctx, index, stint.startLap, laps),
    });
  }

  let cursorSec = elapsed;
  let cursorLap = teamLaps;
  let boxLap: number | null = null;
  let finished = false;

  if (hasCurrent) {
    const driverId = driverOf(current, currentPlanned);
    const lapSec = lapSecFor(ctx, currentPlanned, driverId);
    const fuelPerLap = fuelPerLapFor(ctx, currentPlanned, driverId);
    let plannedBox =
      current.startLap + fullStintLaps(ctx, currentIndex, fuelPerLap);
    const tankLimit = unfueledTankLimit(ctx, actual, lastPosition);
    if (tankLimit !== null) plannedBox = Math.min(plannedBox, tankLimit);
    const fuel =
      typeof input.fuelLevel === 'number' &&
      Number.isFinite(input.fuelLevel) &&
      input.fuelLevel >= 0
        ? input.fuelLevel
        : null;

    let box = Math.max(teamLaps, plannedBox);
    if (fuel !== null && fuelPerLap !== null) {
      const reachesPlan =
        plannedBox >= teamLaps &&
        (plannedBox - teamLaps) * fuelPerLap <= fuel + EPS;
      box = reachesPlan ? plannedBox : teamLaps + lapsOnFuel(fuel, fuelPerLap);
    }

    let lapsLeft = box - teamLaps;
    const toFinish = lapsToFinish(elapsed, raceEndSec, lapSec);
    if (toFinish <= lapsLeft) {
      lapsLeft = toFinish;
      finished = true;
    } else {
      boxLap = box;
    }
    cursorLap = teamLaps + lapsLeft;
    cursorSec = elapsed + lapsLeft * lapSec;
    const laps = cursorLap - current.startLap;
    stints.push({
      ...planFields(ctx, currentIndex),
      driverId: current.driverId,
      startSec: round2(current.startSec),
      endSec: round2(cursorSec),
      startLap: current.startLap,
      laps,
      status: 'current',
      setup: ctx.conditions,
      rebuilt: isRebuilt(ctx, currentIndex, current.startLap, laps),
    });
  }

  let index = currentIndex + 1;
  while (
    !finished &&
    cursorSec < raceEndSec &&
    stints.length < MAX_PROJECTED_STINTS
  ) {
    const planned = planAt(ctx, index);
    const driverId = planned ? planned.driverId : null;
    const lapSec = lapSecFor(ctx, planned, driverId);
    const startSec = cursorSec + ctx.pitSec;
    let laps = fullStintLaps(ctx, index, fuelPerLapFor(ctx, planned, driverId));
    const toFinish = lapsToFinish(startSec, raceEndSec, lapSec);
    if (toFinish <= laps) {
      laps = toFinish;
      finished = true;
    }
    const endSec = startSec + laps * lapSec;
    stints.push({
      ...planFields(ctx, index),
      driverId,
      startSec: round2(startSec),
      endSec: round2(endSec),
      startLap: cursorLap,
      laps,
      status: driverId === null ? 'unassigned' : 'upcoming',
      setup: ctx.conditions,
      rebuilt: isRebuilt(ctx, index, cursorLap, laps),
    });
    cursorLap += laps;
    cursorSec = endSec;
    index++;
  }

  for (; index < ctx.plan.length; index++) {
    if (stints.length >= MAX_PROJECTED_STINTS) break;
    const planned = ctx.plan[index];
    stints.push({
      ...planFields(ctx, index),
      driverId: planned.driverId,
      startSec: planned.startSec,
      endSec: planned.endSec,
      startLap: ctx.planStartLaps[index],
      laps: Math.max(0, planned.laps),
      status: 'dropped',
      setup: planned.setup,
      rebuilt: false,
    });
  }

  const plannedElapsed = plannedElapsedAtLap(
    input.strategy,
    teamLaps,
    hasCurrent && actual.length > 1 && current.startLap === teamLaps
  );
  return {
    stints: numbered(stints),
    boxLap,
    driftSec: plannedElapsed === null ? null : round2(elapsed - plannedElapsed),
  };
}
