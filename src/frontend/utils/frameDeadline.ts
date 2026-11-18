/**
 * Keep a capped animation's phase across late refreshes without catch-up work.
 * Returns the same deadline when early, otherwise the first slot after `now`.
 * The tolerance only absorbs floating-point error at an exact frame boundary.
 */
export const advanceFrameDeadline = (
  now: number,
  deadline: number,
  intervalMs: number
): number =>
  now + 1e-6 < deadline
    ? deadline
    : deadline +
      Math.max(1, Math.floor((now - deadline + 1e-6) / intervalMs) + 1) *
        intervalMs;
