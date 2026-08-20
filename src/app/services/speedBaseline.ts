/**
 * Speed measurement for incident detection.
 *
 * Speed for a remote car has to be derived from its lap distance, because
 * iRacing exposes no per-car speed channel. Doing that frame to frame does not
 * work: the CarIdx position arrays can lag SessionTime by one 60Hz sim tick,
 * and the SDK loop delivers frames at uneven gaps (0.033s / 0.05s / 0.067s), so
 * a single-frame reading carries up to a 33% error.
 *
 * Measuring distance over a fixed baseline instead makes that lag a small
 * fraction of a long distance. The speed error falls to `v * tick / W` and the
 * deceleration error to roughly `2 * v * tick / W^2`:
 *
 *   at 250 km/h    frame to frame (0.05s)   ~417 km/h/s of noise
 *                  baseline W = 0.5s         ~33 km/h/s of noise
 *
 * Against a 150 km/h/s impact threshold the first is unusable — the noise floor
 * sits above the threshold, so steady cornering reads as a crash — and the
 * second leaves a factor of four.
 */

export interface PositionSample {
  sessionTime: number;
  lapDistPct: number;
}

export interface BaselineSpeed {
  /** km/h, averaged across the span. */
  speed: number;
  /** Index of the older sample the span started from. */
  startIndex: number;
  /**
   * Midpoint of the span. An average speed belongs to the middle of the window
   * it was measured over, so this is what two readings must be differenced
   * against to get an acceleration.
   */
  midSessionTime: number;
}

export interface Deceleration {
  /** km/h lost per second. Negative when the car is accelerating. */
  rate: number;
  fromSpeed: number;
  toSpeed: number;
  spanSeconds: number;
}

/** Default baseline. See the module comment for why it is this long. */
export const SPEED_BASELINE_S = 0.5;

/**
 * Average speed over `baselineSeconds` of history ending at `endIndex`, or null
 * when there is not that much history yet.
 *
 * Zero travel is reported as 0 km/h rather than as "no reading" — over a full
 * baseline a car that has not moved really has not moved. Telling a stopped car
 * from a stalled position feed is the caller's job, since only it knows how
 * long the position has been unchanged.
 */
export const baselineSpeed = (
  positions: PositionSample[],
  endIndex: number,
  baselineSeconds: number,
  trackLengthM: number
): BaselineSpeed | null => {
  const end = positions[endIndex];
  if (!end || trackLengthM <= 0) return null;

  let startIndex = -1;
  for (let i = endIndex - 1; i >= 0; i--) {
    if (end.sessionTime - positions[i].sessionTime >= baselineSeconds) {
      startIndex = i;
      break;
    }
  }
  if (startIndex < 0) return null;

  const start = positions[startIndex];
  const span = end.sessionTime - start.sessionTime;
  if (span <= 0) return null;

  let distPct = end.lapDistPct - start.lapDistPct;
  if (distPct < -0.5) distPct += 1.0; // crossed the start/finish line
  // A backwards nudge is not negative travel for this purpose.
  if (distPct < 0) distPct = 0;

  return {
    speed: ((trackLengthM * distPct) / span) * 3.6,
    startIndex,
    midSessionTime: (start.sessionTime + end.sessionTime) / 2,
  };
};

/**
 * Deceleration from two back-to-back baseline speeds, the most recent ending at
 * the newest sample. Returns null until there is enough history for both.
 */
export const measureDeceleration = (
  positions: PositionSample[],
  trackLengthM: number,
  baselineSeconds: number = SPEED_BASELINE_S
): Deceleration | null => {
  const recent = baselineSpeed(
    positions,
    positions.length - 1,
    baselineSeconds,
    trackLengthM
  );
  if (!recent) return null;

  const earlier = baselineSpeed(
    positions,
    recent.startIndex,
    baselineSeconds,
    trackLengthM
  );
  if (!earlier) return null;

  const spanSeconds = recent.midSessionTime - earlier.midSessionTime;
  if (spanSeconds <= 0) return null;

  return {
    rate: (earlier.speed - recent.speed) / spanSeconds,
    fromSpeed: earlier.speed,
    toSpeed: recent.speed,
    spanSeconds,
  };
};
