/**
 * Composes the LMU rank and badge artwork into two sprite sheets.
 *
 * Usage:
 *   npm run build-lmu-sprite
 *
 * The art arrives from Studio 397 as 37 separate SVGs (see
 * fetch-lmu-rank-art.ts), and bundling them that way meant a standings row
 * drew up to sixty individual `<img>` elements. An SVG is re-rasterised
 * whenever its rendered size changes, so every size tweak threw away every
 * cached raster, on an overlay sharing a GPU with the sim.
 *
 * This follows what the car-manufacturer logos already do here: one file, and
 * each cell addressed by `background-position`. The browser rasterises the
 * sheet once per rendered size and every row reads the same texture.
 *
 * Still SVG rather than a PNG sprite like the manufacturer sheet, because
 * rasterising vectors offline would mean a new image dependency for a build
 * step run once. One decode instead of thirty-seven is the win; the remaining
 * difference is a single raster either way.
 *
 * Source ids are namespaced per cell. Every plate carries clip paths named
 * like `clip0_2067_288`, and merging them unprefixed would have each cell
 * clipped by whichever file happened to define that id last.
 */

import fs from 'node:fs';
import path from 'node:path';

const RANK_DIR = path.resolve('src/frontend/assets/lmu/drsr');
const BADGE_DIR = path.resolve('src/frontend/assets/lmu/badges');
const OUT_DIR = path.resolve('src/frontend/assets/lmu');
const POSITIONS_OUT = path.resolve(
  'src/frontend/components/shared/DriverRatingBadge/lmuSpritePositions.ts'
);

/** Kept in step with LMU_TIERED_RANKS and the fetcher's own lists. */
const KINDS = ['dr', 'sr'] as const;
const RANKS = ['Bronze', 'Silver', 'Gold', 'Platinum'] as const;
const TIERS = [0, 1, 2, 3] as const;
const BADGES = [
  'sr-noob',
  'sr-saint',
  'sr-clean',
  'sr-warning',
  'sr-probation',
] as const;

/** Cell sizes, from the source viewBoxes. Asserted below rather than assumed. */
const PLATE_W = 112;
const PLATE_H = 52;
const BADGE_W = 128;
const BADGE_H = 128;

/** Columns in each sheet. Rows follow from the cell count. */
const PLATE_COLS = 8;
const BADGE_COLS = 5;

interface Cell {
  /** The key the renderer looks up, e.g. `dr-Gold3` or `sr-saint`. */
  name: string;
  file: string;
}

/**
 * Strips the outer `<svg>` and namespaces every id inside it.
 *
 * Returns the inner markup, so the caller can place it with a transform.
 */
const inner = (svg: string, prefix: string, expectViewBox: string): string => {
  const viewBox = /viewBox="([^"]*)"/.exec(svg)?.[1];
  if (viewBox !== expectViewBox) {
    throw new Error(
      `unexpected viewBox ${String(viewBox)}, wanted ${expectViewBox}`
    );
  }

  const open = svg.indexOf('>', svg.indexOf('<svg'));
  const close = svg.lastIndexOf('</svg>');
  if (open < 0 || close < 0) throw new Error('not an SVG');
  let body = svg.slice(open + 1, close);

  // Collect the ids this file defines, then rewrite both the definitions and
  // every url(#...) reference to them. Only ids it defines are touched, so a
  // reference to something external would be left alone rather than broken.
  const ids = [...body.matchAll(/id="([^"]+)"/g)].map((m) => m[1]);
  for (const id of ids) {
    const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    body = body.replace(
      new RegExp(`id="${escaped}"`, 'g'),
      `id="${prefix}${id}"`
    );
    body = body.replace(
      new RegExp(`url\\(#${escaped}\\)`, 'g'),
      `url(#${prefix}${id})`
    );
  }
  return body;
};

const sheet = (
  cells: Cell[],
  cols: number,
  cellW: number,
  cellH: number,
  expectViewBox: string
): { svg: string; positions: Record<string, [number, number]> } => {
  const rows = Math.ceil(cells.length / cols);
  const positions: Record<string, [number, number]> = {};
  const parts: string[] = [];

  cells.forEach((cell, index) => {
    const col = index % cols;
    const row = Math.floor(index / cols);
    positions[cell.name] = [col, row];
    const body = inner(
      fs.readFileSync(cell.file, 'utf8'),
      `c${index}_`,
      expectViewBox
    );
    parts.push(
      `<g transform="translate(${col * cellW} ${row * cellH})">${body}</g>`
    );
  });

  const width = cols * cellW;
  const height = rows * cellH;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}" fill="none">` +
    parts.join('') +
    '</svg>';
  return { svg, positions };
};

const plateCells: Cell[] = [];
for (const kind of KINDS) {
  for (const rank of RANKS) {
    for (const tier of TIERS) {
      plateCells.push({
        name: `${kind}-${rank}${tier}`,
        file: path.join(RANK_DIR, `${kind}-${rank}${tier}.svg`),
      });
    }
  }
}

const badgeCells: Cell[] = BADGES.map((badge) => ({
  name: badge,
  file: path.join(BADGE_DIR, `${badge}.svg`),
}));

const plates = sheet(
  plateCells,
  PLATE_COLS,
  PLATE_W,
  PLATE_H,
  `0 0 ${PLATE_W} ${PLATE_H}`
);
const badges = sheet(
  badgeCells,
  BADGE_COLS,
  BADGE_W,
  BADGE_H,
  `0 0 ${BADGE_W} ${BADGE_H}`
);

fs.writeFileSync(path.join(OUT_DIR, 'plates-sprite.svg'), plates.svg);
fs.writeFileSync(path.join(OUT_DIR, 'badges-sprite.svg'), badges.svg);

const asRecord = (positions: Record<string, [number, number]>) =>
  Object.entries(positions)
    .map(([name, [col, row]]) => `  '${name}': [${col}, ${row}],`)
    .join('\n');

fs.writeFileSync(
  POSITIONS_OUT,
  `// Generated by tools/build-lmu-sprite.ts. Do not edit by hand.
//
// Each entry is the cell's [column, row] in its sheet. The renderer turns that
// into a background-position, following the car-manufacturer logos.

/** Cell size and grid of plates-sprite.svg, in source units. */
export const PLATE_CELL = { width: ${PLATE_W}, height: ${PLATE_H} } as const;
export const PLATE_GRID = {
  cols: ${PLATE_COLS},
  rows: ${Math.ceil(plateCells.length / PLATE_COLS)},
} as const;

/** Cell size and grid of badges-sprite.svg. */
export const BADGE_CELL = { width: ${BADGE_W}, height: ${BADGE_H} } as const;
export const BADGE_GRID = {
  cols: ${BADGE_COLS},
  rows: ${Math.ceil(badgeCells.length / BADGE_COLS)},
} as const;

export const PLATE_POSITIONS: Record<string, readonly [number, number]> = {
${asRecord(plates.positions)}
};

export const BADGE_POSITIONS: Record<string, readonly [number, number]> = {
${asRecord(badges.positions)}
};
`
);

console.log(
  `plates-sprite.svg: ${plateCells.length} cells, ` +
    `${PLATE_COLS}x${Math.ceil(plateCells.length / PLATE_COLS)}, ` +
    `${(plates.svg.length / 1024).toFixed(0)} KB`
);
console.log(
  `badges-sprite.svg: ${badgeCells.length} cells, ` +
    `${BADGE_COLS}x${Math.ceil(badgeCells.length / BADGE_COLS)}, ` +
    `${(badges.svg.length / 1024).toFixed(0)} KB`
);
console.log(`positions: ${POSITIONS_OUT}`);
