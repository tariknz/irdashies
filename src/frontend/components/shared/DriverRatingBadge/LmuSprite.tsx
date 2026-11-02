import type { LmuSpriteCell } from './lmuRankArt';

/**
 * One cell of an LMU sprite sheet.
 *
 * A `span` with a positioned background rather than an `img`, following the
 * car-manufacturer logos: the sheet is decoded once and every row reads the
 * same texture, where separate images were re-rasterised per element and per
 * size change.
 *
 * `translateZ(0)` for the same reason it is on the manufacturer logo -- it
 * promotes the element so a repaint of the row does not re-composite the art
 * underneath it, which is what an overlay sharing a GPU with the sim cares
 * about.
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
