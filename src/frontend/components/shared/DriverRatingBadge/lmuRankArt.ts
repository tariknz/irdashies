import type { LmuRank } from '@irdashies/types';

/**
 * The bundled LMU rank and badge artwork.
 *
 * The sim's own UI, and LMUTraceHUB, fetch these from Studio 397's public
 * bucket at render time. Here they are committed under `assets/lmu/` and
 * bundled, because the alternative is a standings row reaching the network
 * once per driver per session — see `tools/fetch-lmu-rank-art.ts`, which is
 * what downloads them.
 *
 * Resolved through `import.meta.glob` rather than thirty-seven import lines,
 * following `WidgetIndex.tsx`. `query: '?url'` keeps them as URLs: referencing
 * an SVG as an image source is what stops anything inside it executing, and
 * these are third-party files.
 *
 * Every lookup can miss. A rank the bucket had no art for, or a badge the
 * service invents after this was last run, returns undefined and the caller
 * falls back to the text chip. That is why nothing here throws.
 */

const RANK_ART = import.meta.glob<string>('../../../assets/lmu/drsr/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});

const BADGE_ART = import.meta.glob<string>('../../../assets/lmu/badges/*.svg', {
  eager: true,
  query: '?url',
  import: 'default',
});

/** Keyed by basename, so the globs' directory prefixes do not leak out. */
const byName = (art: Record<string, string>): Map<string, string> => {
  const out = new Map<string, string>();
  for (const [filePath, url] of Object.entries(art)) {
    const name = filePath.slice(filePath.lastIndexOf('/') + 1, -'.svg'.length);
    out.set(name, url);
  }
  return out;
};

const ranks = byName(RANK_ART);
const badges = byName(BADGE_ART);

/** `dr` is the driver rating, `sr` the safety rating. */
export type LmuRankKind = 'dr' | 'sr';

/**
 * The artwork for one rank, or undefined when there is none bundled.
 *
 * `Pro` deliberately has none: the bucket carries no plate for it, which is
 * why LMUTraceHUB falls back to a text label there too.
 *
 * A missing tier resolves to tier 0, which is the bucket's own spelling of a
 * rank without one.
 */
export const lmuRankArt = (
  kind: LmuRankKind,
  rank: LmuRank,
  tier?: number
): string | undefined => {
  if (rank === 'Pro') return undefined;
  const slot = tier && tier > 0 ? tier : 0;
  return ranks.get(`${kind}-${rank}${slot}`);
};

/** The artwork for an achievement badge, or undefined when it is unknown. */
export const lmuBadgeArt = (badge?: string): string | undefined =>
  badge ? badges.get(badge) : undefined;

/**
 * The height every piece of LMU artwork is drawn at.
 *
 * One constant because the rank plates and the badge sit side by side in a
 * row, and a difference between them reads as a mistake. In `em`, so a widget
 * scaled by font size takes the art with it.
 *
 * The size that actually made these legible was not this number. The standings
 * table is `w-full table-auto` inside an `overflow-hidden` box, and Tailwind's
 * preflight gives every image `max-width: 100%` -- so the table's layout pass
 * compressed the art to fit the row. It painted at full size and was squashed
 * a frame later, which looked like the height being ignored. `LMU_ART_CLASSES`
 * carries the `max-w-none` that stops it.
 *
 * With that fixed, 2em draws larger than 4.5em ever did while leaving the row
 * close to its normal height.
 */
export const LMU_ART_HEIGHT = 'h-[2em]';

/**
 * Every class a piece of LMU artwork needs.
 *
 * `max-w-none` is the load-bearing one: without it the table may compress the
 * image however much it likes, and the height above becomes a suggestion.
 */
export const LMU_ART_CLASSES = `${LMU_ART_HEIGHT} w-auto max-w-none shrink-0`;

/** For diagnostics and tests: what was actually bundled. */
export const lmuArtCounts = () => ({
  ranks: ranks.size,
  badges: badges.size,
});
