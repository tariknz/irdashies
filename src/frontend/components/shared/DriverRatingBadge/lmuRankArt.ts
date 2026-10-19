import type { LmuRank } from '@irdashies/types';
import badgesSprite from '../../../assets/lmu/badges-sprite.svg';
import platesSprite from '../../../assets/lmu/plates-sprite.svg';
import {
  BADGE_GRID,
  BADGE_POSITIONS,
  PLATE_CELL,
  PLATE_GRID,
  PLATE_POSITIONS,
} from './lmuSpritePositions';

/**
 * The bundled LMU rank and badge artwork, as two sprite sheets.
 *
 * The sim's own UI and LMUTraceHUB fetch these from Studio 397's bucket at
 * render time. Here they are committed and bundled, because the alternative is
 * a standings row reaching the network once per driver per session --
 * `tools/fetch-lmu-rank-art.ts` downloads them and
 * `tools/build-lmu-sprite.ts` composes the sheets.
 *
 * Sheets rather than the 37 separate files this used to import. A row drew up
 * to sixty `<img>` elements, and an SVG is re-rasterised whenever its rendered
 * size changes -- so every size tweak discarded every cached raster, on an
 * overlay sharing a GPU with the sim. One sheet is decoded once and every row
 * reads the same texture at the same `background-size`, which is how the
 * car-manufacturer logos have always worked here.
 *
 * Positioning a background also ends a subtler problem: an `<img>` carries
 * Tailwind preflight's `max-width: 100%`, so the standings table was free to
 * squash the art to fit a row and the height became a suggestion. A background
 * cell cannot be compressed by table layout.
 */

/** `dr` is the driver rating, `sr` the safety rating. */
export type LmuRankKind = 'dr' | 'sr';

/**
 * The height every piece of LMU artwork is drawn at.
 *
 * One value because the plates and the badge sit side by side in a row, and a
 * difference between them reads as a mistake. In `em`, so a widget scaled by
 * font size takes the art with it.
 */
export const LMU_ART_HEIGHT_EM = 1.8;

/** Everything a cell needs to be drawn, or undefined when there is no art. */
export interface LmuSpriteCell {
  url: string;
  /** CSS `background-size`, covering the whole sheet. */
  backgroundSize: string;
  /** CSS `background-position`, selecting the cell. */
  backgroundPosition: string;
  /** The cell's own size, so the element keeps the art's aspect. */
  widthEm: number;
  heightEm: number;
}

const cell = (
  url: string,
  position: readonly [number, number] | undefined,
  grid: { readonly cols: number; readonly rows: number },
  aspect: number
): LmuSpriteCell | undefined => {
  if (!position) return undefined;
  const heightEm = LMU_ART_HEIGHT_EM;
  const widthEm = heightEm * aspect;
  const [col, row] = position;
  return {
    url,
    backgroundSize: `${grid.cols * widthEm}em ${grid.rows * heightEm}em`,
    backgroundPosition: `${-col * widthEm}em ${-row * heightEm}em`,
    widthEm,
    heightEm,
  };
};

const PLATE_ASPECT = PLATE_CELL.width / PLATE_CELL.height;
/** The badges are square, so this needs no constant that could go stale. */
const BADGE_ASPECT = 1;

/**
 * The cell for one rank, or undefined when there is none.
 *
 * `Pro` deliberately has none: the bucket carries no plate for it, which is
 * why LMUTraceHUB falls back to a text label there too. A missing tier
 * resolves to tier 0, the bucket's own spelling of a rank without one.
 */
export const lmuRankArt = (
  kind: LmuRankKind,
  rank: LmuRank,
  tier?: number
): LmuSpriteCell | undefined => {
  if (rank === 'Pro') return undefined;
  const slot = tier && tier > 0 ? tier : 0;
  return cell(
    platesSprite,
    PLATE_POSITIONS[`${kind}-${rank}${slot}`],
    PLATE_GRID,
    PLATE_ASPECT
  );
};

/** The cell for an achievement badge, or undefined when it is unknown. */
export const lmuBadgeArt = (badge?: string): LmuSpriteCell | undefined =>
  badge
    ? cell(badgesSprite, BADGE_POSITIONS[badge], BADGE_GRID, BADGE_ASPECT)
    : undefined;

/** For diagnostics and tests: what the sheets actually carry. */
export const lmuArtCounts = () => ({
  ranks: Object.keys(PLATE_POSITIONS).length,
  badges: Object.keys(BADGE_POSITIONS).length,
});
