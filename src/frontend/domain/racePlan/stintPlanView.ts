import type { RacePlanProgressSnapshot, RacePlanState } from '@irdashies/types';
import { summarizeClashes, type RacePlanClashSummary } from './clashes';
import {
  currentStint,
  driverName,
  formatRaceTime,
  nextStint,
  plannedStintCount,
  selectStrategy,
  type RaceTimeOptions,
} from './projection';
import {
  boxLabel,
  boxState,
  driftLevel,
  driftText,
  fuelLevel,
  fuelTargetPerLap,
  planStint,
  type RacePlanBoxState,
  type RacePlanDriftLevel,
  type RacePlanFuelLevel,
} from './stintStatus';
import { snapshotClashes } from './timeline';

export interface StintPlanView {
  /** "Stint 3/23"; "Stint 1/23" before green. */
  stintLabel: string;
  driverName: string | null;
  /** "Lap 12 of 34"; null before green. */
  lapLabel: string | null;
  boxKind: RacePlanBoxState['kind'];
  boxLabel: string;
  /** Litres per lap with 2dp; null when unknown or not visible. */
  fuelTarget: string | null;
  fuelActual: string | null;
  fuelLevel: RacePlanFuelLevel;
  /** False when this client cannot see the team car's fuel. */
  fuelVisible: boolean;
  nextLabel: string | null;
  nextDriverName: string | null;
  nextStart: string | null;
  driftText: string | null;
  driftLevel: RacePlanDriftLevel;
  clashes: RacePlanClashSummary;
}

const litres = (value: number | null) =>
  value === null ? null : value.toFixed(2);

export const buildStintPlanView = (
  snapshot: RacePlanProgressSnapshot,
  planState: RacePlanState | null | undefined,
  options: RaceTimeOptions = {}
): StintPlanView => {
  const planning = planState?.planning ?? null;
  const strategy = selectStrategy(planState, snapshot.strategyId);
  const current = currentStint(snapshot);
  const next = nextStint(snapshot);
  const total = plannedStintCount(snapshot.stints);
  const box = boxState(snapshot);
  const target = fuelTargetPerLap(planStint(strategy, current?.planNumber));
  const actual = snapshot.fuelVisible ? snapshot.fuelPerLap : null;

  return {
    stintLabel: `Stint ${current?.number ?? next?.number ?? 1}/${total}`,
    driverName: current
      ? driverName(planning, snapshot.driverId ?? current.driverId)
      : null,
    lapLabel: current
      ? `Lap ${snapshot.lapsInStint + 1} of ${current.laps}`
      : null,
    boxKind: box.kind,
    boxLabel: boxLabel(box),
    fuelTarget: litres(target),
    fuelActual: litres(actual),
    fuelLevel: fuelLevel(target, actual),
    fuelVisible: snapshot.fuelVisible,
    nextLabel: current ? 'Next' : 'First stint',
    nextDriverName: next ? driverName(planning, next.driverId) : null,
    nextStart: next
      ? formatRaceTime(snapshot.raceStartMs, next.startSec, options)
      : null,
    driftText: driftText(snapshot.driftSec),
    driftLevel: driftLevel(snapshot.driftSec ?? 0),
    clashes: summarizeClashes(
      snapshotClashes(snapshot, planning, options.timeZone)
    ),
  };
};
