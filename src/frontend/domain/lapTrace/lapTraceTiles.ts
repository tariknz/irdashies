/**
 * Tile geometry for the lap trace plot's reference lap.
 *
 * The reference never changes while it is shown, so instead of rebuilding its
 * paths whenever the car moves, the plot draws it in tiles fixed to track
 * distance and slides them under a fixed car line with a composited
 * transform. A tile is built once and then only moved: the compositor shifts
 * its already rasterised layer, so a moving window costs no path building,
 * paint or raster.
 *
 * Tiles are a whole fraction of the lap and at least one window wide, which
 * makes the grid repeat exactly at start/finish (the tile after the last one
 * is the first one again). On a track shorter than the window a tile spans as
 * many whole laps as it takes to be a window wide instead.
 *
 * The plot shows two consecutive tiles in one layer, a span. A window is never
 * wider than a tile, so it always falls inside the span that starts at the
 * tile its left edge is in, and only one layer is on screen at a time. That
 * matters: two layers meeting on screen leave a visible seam where each
 * anti-aliases its half of the boundary pixel, however exactly their content
 * lines up.
 *
 * Bins are anchored to track distance and sized to divide the lap, so a
 * stretch of track bins the same way in every span that holds it — and
 * across start/finish — and the trace does not shift when the plot moves
 * from one span to the next.
 */

/**
 * Decimation bins per window. Each bin emits at most its first, lowest,
 * highest and last sample, so a window never holds more than ~4 × this many
 * points however dense the telemetry, while a one-sample brake stab still
 * shows.
 */
export const PATH_BINS = 250;

/** Tiles in one span: the one the window starts in, and the next. */
export const TILES_PER_SPAN = 2;

/**
 * Span layers the plot keeps: the one on screen, and the next, built ahead
 * of the car so it is ready when the window moves onto it.
 */
export const REFERENCE_SPAN_SLOTS = 2;

export interface TileLayout {
  trackLengthM: number;
  /** Metres the window shows: behind plus ahead. */
  windowM: number;
  /** Length of one tile. */
  tileM: number;
  /**
   * Distinct tiles. Tile `j` (in unwrapped metres, starting at `j * tileM`)
   * draws the content of tile `tileContent(j, layout)`.
   */
  tileCount: number;
  /** Length of one span. */
  spanM: number;
  /** Metres per decimation bin; divides the lap exactly. */
  binM: number;
}

/** Null when the lap or window is degenerate and there is nothing to tile. */
export function tileLayout(
  trackLengthM: number,
  metersBehind: number,
  metersAhead: number
): TileLayout | null {
  const windowM = metersBehind + metersAhead;
  if (!(trackLengthM > 0) || !(windowM > 0)) return null;

  let tileM: number;
  let tileCount: number;
  if (trackLengthM >= windowM) {
    tileCount = Math.floor(trackLengthM / windowM);
    tileM = trackLengthM / tileCount;
  } else {
    tileCount = 1;
    tileM = Math.ceil(windowM / trackLengthM) * trackLengthM;
  }

  return {
    trackLengthM,
    windowM,
    tileM,
    tileCount,
    spanM: TILES_PER_SPAN * tileM,
    binM: lapBinM(trackLengthM, windowM),
  };
}

/**
 * The bin width for a window: no wider than a PATH_BINS-th of it, and
 * dividing the lap exactly.
 */
export function lapBinM(trackLengthM: number, windowM: number): number {
  return trackLengthM / Math.ceil(trackLengthM / (windowM / PATH_BINS));
}

/** Which distinct tile unwrapped tile `j` draws. */
export function tileContent(j: number, layout: TileLayout): number {
  const n = layout.tileCount;
  return ((j % n) + n) % n;
}

/** The unwrapped tile the window's left edge is in: where its span starts. */
export function spanTileAt(
  carDistanceM: number,
  metersBehind: number,
  layout: TileLayout
): number {
  return Math.floor((carDistanceM - metersBehind) / layout.tileM);
}

/**
 * How far to translate a layer starting at `startM` (unwrapped metres) and
 * `widthM` long, as a percentage of its own width, to put it under the
 * window. Percentages of the element itself, so the plot's pixel width never
 * has to be measured.
 */
export function tileTranslatePct(
  startM: number,
  widthM: number,
  carDistanceM: number,
  metersBehind: number
): number {
  return ((startM - carDistanceM + metersBehind) / widthM) * 100;
}

export interface LapPiece {
  /** Lap-local start, in [0, trackLengthM]. */
  fromM: number;
  /** Lap-local end, in [0, trackLengthM]. */
  toM: number;
  /** Add to a lap-local distance to get its unwrapped position. */
  offsetM: number;
}

/**
 * Cut the unwrapped range [fromM, toM] into lap-local pieces, one per lap it
 * touches, in ascending order. Unlike the window, a span can cover several
 * laps on a short track, so `out` grows as needed; it is reused across calls
 * and only allocates when a range needs more pieces than any before it.
 */
export function lapPieces(
  fromM: number,
  toM: number,
  trackLengthM: number,
  out: LapPiece[]
): number {
  if (!(toM > fromM) || !(trackLengthM > 0)) return 0;
  const firstLap = Math.floor(fromM / trackLengthM);
  const lastLap = Math.floor(toM / trackLengthM);
  let count = 0;
  for (let k = firstLap; k <= lastLap; k++) {
    const offsetM = k * trackLengthM;
    const lo = Math.max(fromM, offsetM);
    const hi = Math.min(toM, offsetM + trackLengthM);
    if (hi <= lo) continue;
    if (count === out.length) out.push({ fromM: 0, toM: 0, offsetM: 0 });
    const piece = out[count++];
    piece.fromM = lo - offsetM;
    piece.toM = hi - offsetM;
    piece.offsetM = offsetM;
  }
  return count;
}
