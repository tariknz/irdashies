/**
 * Shaping applied to the delta before it is shown as a number.
 *
 * Both steps exist to stop the readout demanding attention it has not earned:
 * the cap keeps a large delta from turning into a scrolling number when the
 * exact figure no longer matters, and the update threshold keeps a steady delta
 * from flickering between neighbouring values.
 *
 * Kept separate from the component so the behaviour can be tested directly
 * rather than through rendered output.
 */

/**
 * Limit a signed value to +/- cap, preserving its sign.
 *
 * A cap of 0 or less is treated as "no cap" — the settings UI does not offer
 * it, but a hand-edited config should degrade to showing the true value rather
 * than pinning the readout to zero.
 */
export const clampMagnitude = (value: number, cap: number): number => {
  if (!Number.isFinite(cap) || cap <= 0) return value;
  return Math.min(Math.abs(value), cap) * Math.sign(value);
};

/**
 * Slack for the boundary comparison below.
 *
 * Both the threshold and the values are decimals that binary floating point
 * cannot represent exactly: 1.5 - 1.3 is 0.19999999999999996, so a move of
 * exactly the configured 0.2 would otherwise fail a `>=` test and the readout
 * would appear stuck. Far smaller than any threshold the UI offers, so it only
 * ever decides exact-boundary cases.
 */
const BOUNDARY_EPSILON = 1e-9;

/**
 * Hold the previously shown value until the incoming one has moved at least
 * `threshold` away from it.
 *
 * `held` is null on the first value, which is shown as-is. A threshold of 0 or
 * less disables the behaviour entirely.
 *
 * Idempotent: feeding the same value in twice returns the same result, so it is
 * safe to call during render.
 */
export const applyUpdateThreshold = (
  value: number,
  held: number | null,
  threshold: number
): number => {
  if (held === null) return value;
  if (!Number.isFinite(threshold) || threshold <= 0) return value;
  return Math.abs(value - held) + BOUNDARY_EPSILON >= threshold ? value : held;
};
