/**
 * Live progress of the team car against its race plan, published by
 * `RacePlanProgressProcessor` on `race-plan.progress` at 1 Hz.
 *
 * Times are race elapsed seconds: seconds since the race went green, or
 * since the plan's race start before it does. A plan stint's `startSec` is
 * on the same scale, so the two compare directly.
 */

export type RacePlanProgressStatus =
  /** No planning is loaded. */
  | 'no-plan'
  /** A plan is loaded but the race has not gone green (or this is not a race). */
  | 'waiting'
  /** Watching a replay: progress is not tracked. */
  | 'replay'
  | 'racing'
  | 'finished';

/** The loaded plan was made for a different team or track. */
export type RacePlanMismatch = 'team' | 'track';

export type RacePlanConditions = 'dry' | 'wet';

/** A stop in the pit stall by the team car. */
export interface RacePlanStop {
  /** Team laps completed when the car stopped. */
  lap: number;
  elapsedSec: number;
  /** Time in the stall. */
  durationSec: number;
  /** Litres added; null when the fuel level could not be seen. */
  fuelAdded: number | null;
  /** True when fuel was assumed rather than seen (see `fuelVisible`). */
  fuelAssumed: boolean;
  driverChanged: boolean;
  compoundChanged: boolean;
  /** Not at the planned box lap (outside the last laps of the tank). */
  unplanned: boolean;
}

export type RacePlanStintStatus =
  | 'done'
  | 'current'
  | 'upcoming'
  /** An extra stint the plan has no driver for; assign it in iRacePlan. */
  | 'unassigned'
  /** A planned stint that no longer fits in the race. */
  | 'dropped';

export interface RacePlanProjectedStint {
  /** 1-based position in `stints`; a split stint makes later numbers shift. */
  number: number;
  /** Number of the plan stint this stands for; null for an extra stint. */
  planNumber: number | null;
  /** iRacing customer id; actual for done/current, planned otherwise. */
  driverId: number | null;
  /** From the plan; null for an extra stint. */
  plannedStartSec: number | null;
  plannedEndSec: number | null;
  /** Actual for done and current stints, projected otherwise. */
  startSec: number;
  /** Actual for done stints, projected otherwise. */
  endSec: number;
  /** Team lap the stint starts on. */
  startLap: number;
  /** Laps in the stint: actual for done, projected otherwise. */
  laps: number;
  status: RacePlanStintStatus;
  setup: RacePlanConditions;
  /** The stint's laps or times were rebuilt from the plan after a stop. */
  rebuilt: boolean;
}

export interface RacePlanProgressSnapshot {
  status: RacePlanProgressStatus;
  planningId: number | null;
  strategyId: number | null;
  /** `updatedAt` of the strategy in use, to tell when the plan changed. */
  planUpdatedAt: string | null;
  mismatches: RacePlanMismatch[];
  /**
   * Epoch milliseconds of race elapsed 0: the green flag on this PC's clock
   * once racing, otherwise the plan's race start.
   */
  raceStartMs: number | null;
  elapsedSec: number;
  /** Laps completed by the team car. */
  teamLaps: number;
  /** iRacing customer id of whoever is in the team car now. */
  driverId: number | null;
  /** Index into `stints` of the current stint; null before green. */
  currentStintIndex: number | null;
  /** Laps completed in the current stint. */
  lapsInStint: number;
  /**
   * Team laps completed when the car should be in the pits; null when unknown
   * or when the current stint runs to the flag.
   */
  boxLap: number | null;
  /** Laps until `boxLap`; 0 on the in-lap. */
  lapsUntilBox: number | null;
  /** Litres in the team car; null when it cannot be seen. */
  fuelLevel: number | null;
  /** False when this client cannot see the team car's fuel. */
  fuelVisible: boolean;
  /** Measured litres per lap in the current conditions. */
  fuelPerLap: number | null;
  /** Measured green-flag lap time in seconds in the current conditions. */
  lapTimeSec: number | null;
  conditions: RacePlanConditions;
  /** Actual minus planned elapsed time at the same lap; positive is behind. */
  driftSec: number | null;
  stints: RacePlanProjectedStint[];
  /** Most recent last; capped at 64. */
  stops: RacePlanStop[];
  /** Bumped whenever anything above changes. */
  version: number;
}
