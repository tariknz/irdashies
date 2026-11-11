import type { Display } from 'electron';

/** Absorbs floating-point error in a pixel count, e.g. 1638 * 2.5. */
const EPSILON = 1e-6;

const factorsOfTwo = (value: number): number => {
  let count = 0;
  let rest = value;
  while (rest > 0 && rest % 2 === 0) {
    rest /= 2;
    count += 1;
  }
  return count;
};

/**
 * A display length in physical pixels, from the scaled one Electron reports.
 *
 * Electron gives display sizes in DIPs: the physical size divided by the
 * scale factor, rounded up. A 4096 px wide screen at 250% reads 1639 (4096 /
 * 2.5 = 1638.4), and 1639 * 2.5 = 4097.5 is not the resolution. Every
 * physical length that rounds up to the same DIP length is a candidate; the
 * one with the most factors of two is taken, the largest on a tie, since real
 * resolutions are multiples of 8 or 16 almost without exception. That gives
 * back every common resolution at every scale Windows offers it at. Only low
 * resolutions at scales nobody runs them at (1366 or 1050 px at 225% and up)
 * come out two pixels off.
 */
export const physicalLength = (dip: number, scaleFactor: number): number => {
  if (!Number.isFinite(dip) || dip <= 0) return 0;
  const scale =
    Number.isFinite(scaleFactor) && scaleFactor > 0 ? scaleFactor : 1;
  const lowest = Math.floor((dip - 1) * scale + EPSILON) + 1;
  const highest = Math.floor(dip * scale + EPSILON);
  let best = highest;
  for (let length = highest - 1; length >= lowest; length -= 1) {
    if (factorsOfTwo(length) > factorsOfTwo(best)) best = length;
  }
  return best;
};

/** A display's resolution in physical pixels, as its settings show it. */
export const physicalScreenSize = (
  display: Pick<Display, 'size' | 'scaleFactor'>
): { width: number; height: number } => ({
  width: physicalLength(display.size.width, display.scaleFactor),
  height: physicalLength(display.size.height, display.scaleFactor),
});
