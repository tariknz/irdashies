import type { RadarConfig } from '@irdashies/types';

/**
 * Licence colours as on the rating badge (its border shades, which read
 * better than the dark badge fill on a small car). AI drivers carry no
 * licence or rating, and the badge shows them as A.
 */
const LICENCE_COLORS: Readonly<Record<string, string>> = {
  W: '#a1a1aa',
  P: '#a855f7',
  A: '#3b82f6',
  B: '#22c55e',
  C: '#eab308',
  D: '#f97316',
  R: '#ef4444',
};

export const licenceColor = (
  license: string | undefined,
  rating: number | undefined
): string => {
  if (!license || !rating) return LICENCE_COLORS.A;
  return LICENCE_COLORS[license.charAt(0)] ?? LICENCE_COLORS.A;
};

const toRgb = (hex: string): [number, number, number] => {
  const value = parseInt(hex.slice(1), 16);
  return [(value >> 16) & 0xff, (value >> 8) & 0xff, value & 0xff];
};

const toHex = (rgb: readonly number[]): string =>
  `#${rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')}`;

/** Slate grey the player colour is washed towards. */
const PALE_TARGET: readonly number[] = [148, 163, 184];
const PALE_MIX = 0.35;

/** A washed-out shade of `hex`, so rivals sit back from our own car. */
export const paler = (hex: string): string =>
  toHex(
    toRgb(hex).map(
      (channel, index) => channel + (PALE_TARGET[index] - channel) * PALE_MIX
    )
  );

/** Black or white, whichever reads better on `hex`. */
export const textColorFor = (hex: string): string => {
  const [r, g, b] = toRgb(hex);
  return r * 0.299 + g * 0.587 + b * 0.114 > 150 ? '#0f172a' : '#ffffff';
};

export interface RivalColorSource {
  license?: string;
  rating?: number;
  /** Class colour as a hex string. */
  classColor?: string;
}

/** Fill for one rival under the chosen colour mode. */
export const rivalFill = (
  mode: RadarConfig['rivalColorMode'],
  customFill: string,
  { license, rating, classColor }: RivalColorSource
): string => {
  switch (mode) {
    case 'safety':
      return licenceColor(license, rating);
    case 'class':
      return classColor ?? customFill;
    default:
      return customFill;
  }
};
