export interface StintLapResult {
  /** Stint lap number to display, or undefined when nothing should be shown. */
  lap?: number;
  /**
   * True when the overlay joined mid-session and the car has not pitted since,
   * so its stint lap is genuinely unknown (render a placeholder rather than a
   * misleading total session lap).
   */
  unknown: boolean;
}

export interface StintLapParams {
  /** Total session lap for the car (CarIdxLap). */
  lastLap?: number;
  /** Session lap of the car's last observed pit stop. */
  lastPitLap?: number;
  /** CarIdxLap when the overlay first observed this car. */
  firstObservedLap?: number;
  /** True on tracks where the pit exit is before the start/finish line. */
  pitExitAfterSF?: boolean;
  /**
   * Whether the car is out in the world (carTrackSurface > -1). When explicitly
   * false the car is in the garage, not loaded, or disconnected, so no lap count
   * is shown at all.
   */
  onTrack?: boolean;
}

/**
 * Computes the current stint lap (laps since the last pit stop) for a car.
 *
 * Three outcomes:
 * - We observed the car's pit stop → exact stint lap (matches the pit badge).
 * - No pit, but we watched the car from its session start → first-stint lap
 *   equals the total session lap.
 * - No pit and we joined mid-session → unknown, caller should show a placeholder.
 */
export function computeStintLap({
  lastLap,
  lastPitLap,
  firstObservedLap,
  pitExitAfterSF,
  onTrack,
}: StintLapParams): StintLapResult {
  // Car not out in the world (garage / not loaded / disconnected) → show nothing.
  if (onTrack === false) {
    return { lap: undefined, unknown: false };
  }

  if (lastLap === undefined) {
    return { lap: undefined, unknown: false };
  }

  // We observed this car's pit stop → stint lap is accurate. Mirrors the pit
  // status badge's lapsSinceLastPit formula for consistency.
  if (lastPitLap !== undefined && lastPitLap > 0) {
    const stint = pitExitAfterSF
      ? lastLap - lastPitLap
      : lastLap - lastPitLap + 1;
    return { lap: stint, unknown: false };
  }

  // No pit observed, but we watched the car from its session start (lap 0/1).
  // Count the out-lap as L1: before the first S/F crossing CarIdxLap is 0 → L1,
  // after the first crossing CarIdxLap is 1 → L2. This mirrors the observed-pit
  // formula above, where the out-lap before the first crossing is also L1.
  if (firstObservedLap !== undefined && firstObservedLap <= 1) {
    return { lap: lastLap + 1, unknown: false };
  }

  // We joined mid-session and the car hasn't pitted since — stint lap unknown.
  return { lap: undefined, unknown: true };
}
