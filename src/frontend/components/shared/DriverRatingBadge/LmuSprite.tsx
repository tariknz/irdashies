import type { LmuSpriteCell } from './lmuRankArt';

/**
 * One cell of an LMU sprite sheet.
 *
 * A `span` with a positioned background rather than an `img`, following the
 * car-manufacturer logos: the sheet is decoded once and every row reads the
 * same texture, where separate images were re-rasterised per element and per
 * size change.
 *
 * These LMU badges still request a compositor layer. Revisit that separately
 * with a full LMU-grid capture; the iRacing manufacturer-logo measurements do
 * not cover this art.
 */
export const LmuSprite = ({
  cell,
  title,
}: {
  cell: LmuSpriteCell;
  title: string;
}) => (
  <span
    role="img"
    aria-label={title}
    title={title}
    className="inline-block shrink-0 bg-no-repeat"
    style={{
      backgroundImage: `url(${cell.url})`,
      backgroundSize: cell.backgroundSize,
      backgroundPosition: cell.backgroundPosition,
      width: `${cell.widthEm}em`,
      height: `${cell.heightEm}em`,
      transform: 'translateZ(0)',
    }}
  />
);
