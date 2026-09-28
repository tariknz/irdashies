import { SessionState } from '@irdashies/types';

/**
 * The starting grid, as far as the radar can reconstruct it.
 *
 * The SDK publishes neither a lateral position nor a grid slot before the
 * start, so this began as a reconstruction from the gaps along the road. The
 * sim turned out to publish the grid itself, and everything here now reads
 * that: `CarIdxPaceRow` and `CarIdxPaceLine` name the row and the column of
 * every car on the grid, and they are what the field is drawn from.
 */
export interface GridLayout {
  /** Cars abreast, 1 for a single-file grid. */
  columns: number;
  /**
   * Metres from the centreline to the middle of a column, signed to the
   * driver's right. The sim names the column but not where it stands, so the
   * distance is the road's own geometry: a car stands in the middle of its lane.
   */
  columnLateralM: number;
}

/**
 * Half a lane's width to either side of the centreline for a car standing on
 * the grid. The sim reports which column a car is in but not how far out it
 * sits, so this is the one part of the placement that is still an assumption —
 * and the only one, since the side, the row and the pairing are all read.
 */
const COLUMN_LATERAL_M = 2.5;

/**
 * A grid the radar cannot reconstruct. A layout it will not place is reported
 * as unknown rather than guessed at, which leaves every car on the centreline
 * projection — what the radar did before this existed.
 */
export const UNKNOWN_GRID: GridLayout | null = null;

const COLUMN_PATTERN = /(\d+)\s*x\s*(\d+)/;

/**
 * Reads the column count out of the SDK's grid label.
 *
 * `WeekendInfo.WeekendOptions.StartingGrid` is free text such as
 * `"2x2 inline pole on left"` or `"single file"`. Only the column count is
 * taken, as a cross-check on the sim's own line numbering: a grid the sim
 * numbers beyond the columns the session advertises is one this will not draw,
 * because the placement is a statement about the two-abreast grid alone.
 */
export const parseGridLayout = (
  startingGrid: string | undefined
): GridLayout | null => {
  if (!startingGrid) return UNKNOWN_GRID;
  const match = COLUMN_PATTERN.exec(startingGrid);
  if (!match) return UNKNOWN_GRID;
  const columns = Number.parseInt(match[1], 10);
  if (!Number.isFinite(columns) || columns !== 2) return UNKNOWN_GRID;
  // Only the two-abreast grid is placed. A wider grid would put a third column
  // in the middle of the player's view, which is a different drawing problem,
  // and a single-file grid has no columns to pair at all.
  return { columns, columnLateralM: COLUMN_LATERAL_M };
};

/** A car the grid may place, as the sim numbered it. */
export interface GridColumnCandidate {
  readonly carIdx: number;
  /** `CarIdxPaceLine`: 0 for the left column of the row, 1 for the right. */
  readonly line: number;
  /** `CarIdxPaceRow`, needed only to recognise the player's own row. */
  readonly row: number;
}

/**
 * Puts every car of a standing grid into the column the sim says it is in.
 *
 * `CarIdxPaceLine` is the sim's own column and there is nothing to infer: line 0
 * is the left column of the row and line 1 the right, which is what a recorded
 * Nürburgring grid shows — the player sat in line 0 with `CarLeftRight`
 * reporting their partner to the right, and the partner was line 1. The sign
 * matches the overlap verdict's, where negative is the player's left.
 *
 * The player's own row is skipped. The sim's `CarLeftRight` verdict already
 * places the car alongside the player, and that verdict is a reading about the
 * player's own car rather than one for every car on the grid. The rows further
 * out have no such reading, but they do not need one: this is the same
 * numbering the player's row is drawn from, so it stands on its own.
 *
 * The row's distance along the road is not touched. The measured gap already
 * carries the real fore/aft distance to the player's row, and moving it again
 * would double-count it.
 *
 * @returns Side to draw on by CarIdx, or null when no row could be placed.
 */
export const assignGridColumns = (
  cars: readonly GridColumnCandidate[],
  layout: GridLayout,
  playerRow = -1
): Map<number, number> | null => {
  if (layout.columns < 2) return UNKNOWN_GRID;

  const columns = new Map<number, number>();
  for (const car of cars) {
    if (car.row < 0 || car.row === playerRow) continue;
    if (car.line < 0 || car.line >= layout.columns) continue;
    columns.set(
      car.carIdx,
      car.line % 2 === 0 ? -layout.columnLateralM : layout.columnLateralM
    );
  }

  return columns.size > 0 ? columns : null;
};

/**
 * Whether the session is in the window where the grid placement applies.
 *
 * The sim only numbers a grid before the lights: from Racing onwards every
 * `CarIdxPaceRow` and `CarIdxPaceLine` reads -1, so the placement stops by
 * itself. The state check is the belt to that braces, and it keeps the radar
 * from reading a number that means nothing on a track where the field is not
 * on a grid at all. A red-flag restart forms the same shape but is reported as
 * Racing, and is left to the projection.
 */
export const isGridBeforeStart = (sessionState: number): boolean =>
  Number.isFinite(sessionState) &&
  sessionState > SessionState.Invalid &&
  sessionState < SessionState.Racing;
