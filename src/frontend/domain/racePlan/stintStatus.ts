import type {
  RacePlanProgressSnapshot,
  RacePlanStint,
  RacePlanStop,
  RacePlanStrategy,
} from '@irdashies/types';

export type RacePlanBoxState =
  { kind: 'box-now' } | { kind: 'box-in'; laps: number } | { kind: 'unknown' };

export const boxState = (
  snapshot: Pick<RacePlanProgressSnapshot, 'boxLap' | 'lapsUntilBox'>
): RacePlanBoxState => {
  const { boxLap, lapsUntilBox } = snapshot;
  if (boxLap === null || lapsUntilBox === null || lapsUntilBox < 0) {
    return { kind: 'unknown' };
  }
  return lapsUntilBox === 0
    ? { kind: 'box-now' }
    : { kind: 'box-in', laps: lapsUntilBox };
};

export const boxLabel = (state: RacePlanBoxState): string => {
  switch (state.kind) {
    case 'box-now':
      return 'Box this lap';
    case 'box-in':
      return `Box in ${state.laps}`;
    default:
      return 'Box lap unknown';
  }
};

/** Drift within this many seconds counts as on plan. */
export const ON_PLAN_SEC = 1;

export type RacePlanDriftLevel = 'behind' | 'ahead' | 'on-plan';

export const driftLevel = (driftSec: number): RacePlanDriftLevel =>
  Math.abs(driftSec) < ON_PLAN_SEC
    ? 'on-plan'
    : driftSec > 0
      ? 'behind'
      : 'ahead';

/** "2:14", or "1:02:14" past an hour. */
const formatSpan = (seconds: number) => {
  const total = Math.round(Math.abs(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secs = String(total % 60).padStart(2, '0');
  return hours > 0
    ? `${hours}:${String(minutes).padStart(2, '0')}:${secs}`
    : `${minutes}:${secs}`;
};

/** "+2:14 behind plan", "-0:45 ahead of plan" or "On plan"; null when unknown. */
export const driftText = (driftSec: number | null): string | null => {
  if (driftSec === null || !Number.isFinite(driftSec)) return null;
  switch (driftLevel(driftSec)) {
    case 'behind':
      return `+${formatSpan(driftSec)} behind plan`;
    case 'ahead':
      return `-${formatSpan(driftSec)} ahead of plan`;
    default:
      return 'On plan';
  }
};

export const planStint = (
  strategy: RacePlanStrategy | null | undefined,
  stintNumber: number | null | undefined
): RacePlanStint | null =>
  stintNumber === null || stintNumber === undefined
    ? null
    : (strategy?.stints.find((stint) => stint.number === stintNumber) ?? null);

/** Litres per lap the plan allows for a stint: its fuel over its laps. */
export const fuelTargetPerLap = (
  stint: Pick<RacePlanStint, 'fuel' | 'laps'> | null | undefined
): number | null => {
  if (!stint || stint.fuel === null || stint.fuel <= 0 || stint.laps <= 0) {
    return null;
  }
  return stint.fuel / stint.laps;
};

export type RacePlanFuelLevel = 'on-target' | 'over' | 'unknown';

/** Whether the measured use per lap is within the plan's target. */
export const fuelLevel = (
  target: number | null,
  actual: number | null
): RacePlanFuelLevel => {
  if (target === null || actual === null) return 'unknown';
  // Compared at the 2dp the widget shows.
  return Math.round(actual * 100) > Math.round(target * 100)
    ? 'over'
    : 'on-target';
};

/** "Stop lap 147: fuel, no driver change". */
export const describeStop = (stop: RacePlanStop): string => {
  const parts: string[] = [];
  if (stop.fuelAssumed) parts.push('fuel (assumed)');
  else if (stop.fuelAdded === null) parts.push('fuel unknown');
  else parts.push(stop.fuelAdded > 0 ? 'fuel' : 'no fuel');
  parts.push(stop.driverChanged ? 'driver change' : 'no driver change');
  if (stop.compoundChanged) parts.push('tyre change');
  return `Stop lap ${stop.lap}: ${parts.join(', ')}`;
};

/** The most recent unplanned stops, newest first. */
export const recentUnplannedStops = (
  stops: readonly RacePlanStop[],
  limit = 5
): RacePlanStop[] =>
  stops
    .filter((stop) => stop.unplanned)
    .slice(-limit)
    .reverse();
