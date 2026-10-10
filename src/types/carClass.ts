/**
 * The car-class colour palette, fastest class first.
 *
 * These are iRacing's own class-colour integers. They are the vocabulary the
 * renderer's colour lookup is keyed on, so a simulator that has no class
 * colours of its own picks from this list by speed rank rather than inventing
 * values the lookup would not recognise.
 *
 * Shared from here because the mapper that assigns them runs in the main
 * process, which cannot import from the frontend.
 */
export const CLASS_COLOURS_FASTEST_FIRST: readonly number[] = [
  16767577, // yellow
  3395327, // blue
  16734344, // red
  11430911, // cyan
  5504887, // pink
  13849600, // purple
  13421772, // amber
  39321, // lime
];

/** No class colour. The renderer falls back to its neutral default. */
export const NO_CLASS_COLOUR = 0;

/**
 * Le Mans Ultimate's class colours, keyed by canonical class name.
 *
 * LMU reports no class colour of its own, and unlike the rank-based fallback
 * above its grid is a fixed, known set of five classes -- so they get the
 * series' own liveries rather than whichever palette slot their speed rank
 * happened to land on. These are exact values, not members of the Tailwind
 * palette, so `colors.ts` carries a matching entry for each.
 */
export const LMU_CLASS_COLOURS: Readonly<Record<string, number>> = {
  Hypercar: 0xff000a,
  LMP2: 0x0690ff,
  LMP3: 0x763993,
  LMGT3: 0x00ff6a,
  LMGTE: 0xfff600,
};

/**
 * The palette entry for a class at this speed rank, 0 being the fastest.
 *
 * A rank past the end of the palette returns no colour rather than wrapping:
 * reusing a colour would say two classes are the same speed tier.
 */
export const classColourForRank = (rank: number): number =>
  rank >= 0 && rank < CLASS_COLOURS_FASTEST_FIRST.length
    ? CLASS_COLOURS_FASTEST_FIRST[rank]
    : NO_CLASS_COLOUR;
