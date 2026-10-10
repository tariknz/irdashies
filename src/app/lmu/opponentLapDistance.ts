/**
 * Poll-rate lap positions for every car, not just the player.
 *
 * LMU's scoring block carries `mLapDist` for all cars but publishes at 5 Hz,
 * which on a 7 km circuit quantises an opponent's position to ~14 m steps.
 * Everything downstream that differentiates that signal inherits the steps:
 * CarSpeedsProcessor derives opponent speed from it, and the slow-car and
 * faster-car warnings threshold on that speed.
 *
 * The per-vehicle telemetry block updates at 100 Hz and now exports speed, lap
 * number and clock per car, so each one can be integrated between scoring
 * updates exactly as the player's already is -- this reuses
 * `estimateLmuLapDistPct` rather than reimplementing it, so there is one
 * integrator with one set of resync rules and one set of tests.
 *
 * Cost. The deliberate choice here is dead reckoning over projecting world
 * position onto the track centreline. Projection would mean a nearest-point
 * search against 512 `trackPathPoints` per car per frame -- on a full grid
 * that is 104 x 512 x 64 Hz, around 3.4M distance evaluations a second, and it
 * needs a recorded map to work at all. Integration is a handful of arithmetic
 * operations per car with no search, no map dependency, and it is the
 * technique already proven on the player. The remaining costs are kept down
 * by:
 *
 * - writing in place into the array the caller already built, so a frame
 *   allocates nothing;
 * - holding per-car state in one lazily grown array indexed by car slot, so
 *   there is no per-frame map or object churn;
 * - skipping unoccupied slots and cars whose telemetry is absent, which falls
 *   them back to the scoring value rather than inventing one;
 * - skipping the player, whose slot the caller fills from its own integrator.
 *
 * Acquisition is free: the bridge already copies the whole 324,820-byte
 * snapshot every poll and already builds these per-car arrays, so nothing new
 * is read or converted to get here.
 */

import {
  createLmuLapDistanceState,
  estimateLmuLapDistPct,
  type LmuLapDistanceState,
} from './lapDistance';

/** Per-car integrator state, indexed by car slot. Grown as slots appear. */
export interface LmuOpponentLapDistanceState {
  byCarIdx: (LmuLapDistanceState | undefined)[];
}

export const createLmuOpponentLapDistanceState =
  (): LmuOpponentLapDistanceState => ({ byCarIdx: [] });

/** Forgets every car. For a track change or a session restart. */
export const resetLmuOpponentLapDistanceState = (
  state: LmuOpponentLapDistanceState
): void => {
  state.byCarIdx.length = 0;
};

export interface LmuOpponentLapDistanceFrame {
  /** The 5 Hz scoring fraction per car, 0..1. */
  scoringPcts: ArrayLike<number> | undefined;
  /** 100 Hz speed magnitude per car, m/s. */
  speeds: ArrayLike<number> | undefined;
  /** 100 Hz lap number per car, so a lap boundary forces a resync. */
  lapNumbers: ArrayLike<number> | undefined;
  /** 100 Hz per-car telemetry clock, seconds. */
  elapsedTimes: ArrayLike<number> | undefined;
  /** 1 when this slot had a telemetry entry this frame. */
  telemetryAvailable: ArrayLike<number> | undefined;
  trackLengthM: number;
  /** Slot the caller fills itself; -1 to integrate every car. */
  playerCarIdx: number;
}

/**
 * Refines `out` in place, leaving any car it cannot integrate untouched.
 *
 * Untouched means the caller's scoring value stands, so the worst case is
 * exactly the behaviour before this existed.
 */
export function refineLmuOpponentLapDistPcts(
  state: LmuOpponentLapDistanceState,
  out: number[],
  frame: LmuOpponentLapDistanceFrame
): void {
  const {
    scoringPcts,
    speeds,
    lapNumbers,
    elapsedTimes,
    telemetryAvailable,
    trackLengthM,
    playerCarIdx,
  } = frame;

  // Without a track length there is no fraction to advance by, and without the
  // telemetry trio there is nothing to advance with.
  if (
    !(trackLengthM > 0) ||
    !scoringPcts ||
    !speeds ||
    !lapNumbers ||
    !elapsedTimes
  ) {
    return;
  }

  const { byCarIdx } = state;
  const count = Math.min(out.length, scoringPcts.length);

  for (let carIdx = 0; carIdx < count; carIdx++) {
    if (carIdx === playerCarIdx) continue;
    // No telemetry entry this frame: the slot is empty, or the car is not in
    // the world. Either way there is nothing to integrate and the scoring
    // value is the honest answer.
    if (telemetryAvailable && !telemetryAvailable[carIdx]) {
      byCarIdx[carIdx] = undefined;
      continue;
    }

    const scoringPct = scoringPcts[carIdx];
    if (!(scoringPct >= 0)) {
      byCarIdx[carIdx] = undefined;
      continue;
    }

    const carState = (byCarIdx[carIdx] ??= createLmuLapDistanceState());
    out[carIdx] = estimateLmuLapDistPct(carState, {
      scoringPct,
      elapsedTime: elapsedTimes[carIdx],
      lapNumber: lapNumbers[carIdx],
      speedMs: speeds[carIdx],
      trackLengthM,
    });
  }
}
