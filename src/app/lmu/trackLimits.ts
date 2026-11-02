/**
 * LMU's track-limits penalty points.
 *
 * The sim counts infringements in "steps" and displays them as points: a
 * reading of `0.25 / 3.00` is one step of four-to-a-point, against a ceiling
 * of twelve steps, and at the ceiling a drive-through is served. Three fields
 * carry it, and none of them means anything alone --
 * `LMUVehicleTelemetry.mTrackLimitsSteps` per car, divided by
 * `mTrackLimitsStepsPerPoint`, against `mTrackLimitsStepsPerPenalty` over the
 * same divisor.
 *
 * Converted here rather than in a widget, because the steps are an encoding
 * detail of this sim and the rest of the app has no business knowing it. The
 * division is the same one TinyPedal's LMU adapter does, which is the only
 * other published reading of these fields.
 *
 * Nothing in iRacing corresponds: its incident points are a different system
 * with a different scale, which is why these ride on their own channels
 * rather than being folded into the incident count.
 */

/** What a car reports when it had no telemetry block that frame. */
export const TRACK_LIMITS_UNKNOWN = -1;

/**
 * Points from steps, or undefined when the scale is unknown.
 *
 * Undefined rather than 0: with no divisor there is no points figure, and
 * publishing 0 would show every car as clean.
 */
export const lmuTrackLimitsPoints = (
  steps: number | undefined,
  stepsPerPoint: number | undefined
): number | undefined => {
  if (
    typeof steps !== 'number' ||
    !Number.isFinite(steps) ||
    steps < 0 ||
    typeof stepsPerPoint !== 'number' ||
    !Number.isFinite(stepsPerPoint) ||
    stepsPerPoint <= 0
  ) {
    return undefined;
  }
  return steps / stepsPerPoint;
};

/**
 * The points a penalty is served at, or undefined when unknown.
 *
 * The ceiling the display counts towards. Expressed in points rather than
 * steps so it can be compared with the figure above directly.
 */
export const lmuTrackLimitsMax = (
  stepsPerPenalty: number | undefined,
  stepsPerPoint: number | undefined
): number | undefined => lmuTrackLimitsPoints(stepsPerPenalty, stepsPerPoint);

/**
 * The per-car points channel, one entry per slot.
 *
 * A car with no reading, or a session with no scale, publishes -1 rather than
 * 0 -- a clean car and an unknown one must not look the same, because one of
 * them is information and the other is an absence.
 */
export const lmuTrackLimitsChannel = (
  steps: ArrayLike<number> | undefined,
  stepsPerPoint: number | undefined
): number[] => {
  if (!steps) return [];
  const out = new Array<number>(steps.length);
  for (let carIdx = 0; carIdx < steps.length; carIdx += 1) {
    out[carIdx] =
      lmuTrackLimitsPoints(steps[carIdx], stepsPerPoint) ??
      TRACK_LIMITS_UNKNOWN;
  }
  return out;
};
