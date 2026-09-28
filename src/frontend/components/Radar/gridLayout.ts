import { SessionState } from '@irdashies/types';

/**
 * The starting grid, as far as the SDK describes it.
 *
 * `WeekendInfo.WeekendOptions.StartingGrid` is a free-text label such as
 * `"2x2 inline pole on left"`. Only two facts are needed from it: how many
 * columns the grid has, and which side the pole car sits in — the second
 * decides the column a given slot belongs to.
 */
export interface GridLayout {
  /** Cars abreast, 1 for a single-file grid. */
  columns: number;
  /** Metres the driver's right, for a car in the pole column. */
  poleLateralM: number;
}

/**
 * Half a lane's width to either side of the centreline for a car standing on
 * the grid. The sim does not report the offset, so this is the road's own
 * geometry: a car is drawn on the centre of its lane, not its track edge.
 */
const POLE_LATERAL_M = 2.5;

/**
 * A grid the radar cannot reconstruct. A single-file or 3-wide grid would need
 * a different column assignment, so it is reported as unknown rather than
 * guessed at — the radar then falls back to the centreline projection.
 */
export const UNKNOWN_GRID: GridLayout | null = null;

const COLUMN_PATTERN = /(\d+)\s*x\s*(\d+)/;

/**
 * Reads the column count and pole side out of the SDK's grid label.
 *
 * `"2x2 inline pole on left"` is the only form seen in practice: the first
 * number is the columns abreast. The pole side flips which column the first
 * slot belongs to, so a grid labelled `right` is mirrored rather than treated
 * as the same layout.
 */
export const parseGridLayout = (
  startingGrid: string | undefined
): GridLayout | null => {
  if (!startingGrid) return UNKNOWN_GRID;
  const match = COLUMN_PATTERN.exec(startingGrid);
  if (!match) return UNKNOWN_GRID;
  const columns = Number.parseInt(match[1], 10);
  if (!Number.isFinite(columns) || columns < 2) return UNKNOWN_GRID;
  // Only the two-abreast grid has been reasoned about. Anything wider puts a
  // third column in the middle of the player's view, which is a different
  // drawing problem, so those are left to the centreline projection.
  if (columns !== 2) return UNKNOWN_GRID;
  return {
    columns,
    poleLateralM: /pole on right/i.test(startingGrid)
      ? POLE_LATERAL_M
      : -POLE_LATERAL_M,
  };
};

/**
 * Which column of the grid a slot belongs to, as a signed lateral offset in
 * metres: negative is the driver's left.
 *
 * Slots fill the pole column first, one per row, then the second column — so
 * slots 1 and 2 share a row. Only the two-abreast grid is described, and the
 * sign of the pole offset carries which side that first column is on.
 */
export const gridSlotLateralM = (
  slot: number,
  layout: GridLayout
): number | null => {
  if (!Number.isFinite(slot) || slot < 1) return null;
  const rowIndex = slot - 1;
  const isSecondColumn = rowIndex % layout.columns === layout.columns - 1;
  // Odd slots take the pole column's offset, even slots the far one. The
  // player's own car is never offset this way, so its slot is irrelevant
  // here; the caller passes 0 for it.
  if (isSecondColumn) return -layout.poleLateralM;
  return layout.poleLateralM;
};

/**
 * Whether the session is in the window where the grid reconstruction applies.
 *
 * The cars are still parked and the sim is still publishing the grid slot, so
 * this is the only stretch where the offset is a statement of fact. It ends at
 * Racing: from the lights onwards the cars move, and the offset would be a
 * guess about where they meant to be.
 */
export const isGridBeforeStart = (sessionState: number): boolean =>
  Number.isFinite(sessionState) &&
  sessionState > SessionState.Invalid &&
  sessionState < SessionState.Racing;
