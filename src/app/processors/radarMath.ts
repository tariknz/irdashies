/** Shortest signed lap fraction from `from` to `to`, in -0.5..0.5. */
export const wrapDelta = (to: number, from: number): number => {
  let delta = to - from;
  if (delta > 0.5) delta -= 1;
  else if (delta < -0.5) delta += 1;
  return delta;
};
