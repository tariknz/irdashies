import { SessionState } from '@irdashies/types';

/**
 * The starting grid, as far as the radar can reconstruct it.
 *
 * iRacing publishes no per-car world lateral position. Rolling starts provide
 * `CarIdxPaceRow` and `CarIdxPaceLine`; standing starts leave them unassigned,
 * so the radar reconstructs slots from qualifying order until the lights.
 */
export interface GridLayout {
  /** Cars abreast, 1 for a single-file grid. */
  columns: number;
  /** Physical side occupied by line 0, the pole lane. */
  poleSide: 'left' | 'right';
  /** Metres between adjacent columns, signed to the driver's right. */
  columnLateralM: number;
}
/**
 * Spacing between adjacent grid columns, in metres. The sim reports which
 * column a car is in but not how far out it sits, so this is the one part of
 * the placement that is still an assumption — and the only one, since the side,
 * the row and the pairing are all read. It is slightly widened so default-width
 * car bodies have a visible gap in the radar; it is not measured world geometry.
 */
const COLUMN_LATERAL_M = 3.0;

/**
 * A grid the radar cannot reconstruct. A layout it will not place is reported
 * as unknown rather than guessed at, which leaves every car on the centreline
 * projection — what the radar did before this existed.
 */
const UNKNOWN_GRID: GridLayout | null = null;

const COLUMN_PATTERN = /(\d+)\s*x\s*(\d+)/;

const poleSideFromLabel = (
  startingGrid: string | undefined
): 'left' | 'right' =>
  startingGrid && /pole\s+on\s+right/i.test(startingGrid) ? 'right' : 'left';

/** A car the grid may place, as the sim numbered it. */
export interface GridColumnCandidate {
  readonly carIdx: number;
  /** `CarIdxPaceLine`: 0 for the pole lane, 1 for the other lane. */
  readonly line: number;
  /** `CarIdxPaceRow`; negative means the sim has not assigned the car yet. */
  readonly row: number;
}

/** A qualifying result used to reconstruct a standing-start slot. */
export interface QualifyingGridPosition {
  readonly CarIdx: number;
  /** Zero-based order: 0 is pole, 1 is the next starter. */
  readonly Position: number;
}

/**
 * Builds two-column grid slots from the order used for standing starts, where
 * iRacing leaves the pace-row and pace-line telemetry unassigned.
 */
export const candidatesFromQualifyingOrder = (
  results: readonly QualifyingGridPosition[],
  columns: number,
  carCount: number
): GridColumnCandidate[] => {
  if (!Number.isInteger(columns) || columns < 2 || carCount <= 0) return [];

  const candidates: GridColumnCandidate[] = [];
  const seenCars = new Set<number>();
  const seenPositions = new Set<number>();
  for (const { CarIdx, Position } of results) {
    if (
      !Number.isInteger(CarIdx) ||
      CarIdx < 0 ||
      CarIdx >= carCount ||
      !Number.isInteger(Position) ||
      Position < 0 ||
      seenCars.has(CarIdx) ||
      seenPositions.has(Position)
    ) {
      continue;
    }
    seenCars.add(CarIdx);
    seenPositions.add(Position);
    candidates.push({
      carIdx: CarIdx,
      row: Math.floor(Position / columns),
      line: Position % columns,
    });
  }
  return candidates;
};

/**
 * Reads the column count off the sim's own line numbering.
 *
 * The session's `StartingGrid` label cannot be trusted for this. A recorded
 * Road Atlanta grid reports `"single file"` while the sim numbers twenty cars
 * across ten rows in lines 0 and 1, with the two cars of a row reporting the
 * same lap distance to two decimals. The label is what the session is
 * configured for, and it is not what the field is standing in.
 *
 * `CarIdxPaceLine` is that: the column the sim has actually put each car in. It
 * is also the only source that says how many columns there are, since the count
 * is implied by the highest line in use rather than stated anywhere.
 *
 * Both fields are needed to read it. Row -1 with line -1 is what the sim
 * reports for a car that is in the session but not on a grid, and a car that
 * has not been placed on the road yet reports row 0 — so a single car with
 * `row 0, line -1` while the others sit in a column is a partially filled
 * grid, not a one-row grid. Only a row that the sim numbered *and* a line it
 * assigned together make a column.
 *
 * @returns The layout, or null when the sim has numbered no two-abreast field.
 */
export const columnsFromPaceLines = (
  cars: readonly GridColumnCandidate[]
): GridLayout | null => {
  let widest = -1;
  const lines = new Set<number>();
  for (const car of cars) {
    if (car.row < 0 || car.line < 0) continue;
    if (car.line > widest) widest = car.line;
    lines.add(car.line);
  }
  // A single-file grid numbers every car line 0, and a field that is not on a
  // grid numbers nothing at all. Neither has columns to pair.
  if (lines.size < 2) return UNKNOWN_GRID;
  // Only the two-abreast grid is placed: a third column would sit in the
  // middle of the player's view, which is a different drawing problem, and the
  // line numbering alone cannot say which side of the road it is on.
  if (widest !== 1) return UNKNOWN_GRID;
  return {
    columns: 2,
    poleSide: 'left',
    columnLateralM: COLUMN_LATERAL_M,
  };
};

/**
 * Whether the sim has numbered a grid at all, whatever its shape.
 *
 * Separate from the layout because the two questions have different answers. A
 * single-file grid and a field that is not on a grid both yield no layout, but
 * only the second may fall back to the label: a grid the sim has numbered and
 * this will not place is one where the label is describing something other than
 * the field in front of the player, which is the very thing the label cannot be
 * trusted about.
 */
const hasNumberedGrid = (cars: readonly GridColumnCandidate[]): boolean =>
  cars.some((car) => car.row >= 0);

/**
 * Reads the two-column shape and pole-side orientation from session metadata.
 *
 * Pace-line telemetry chooses the shape when present; the label is the shape
 * fallback for standing starts where pace slots are unassigned. Its pole-side
 * phrase, when present, identifies the physical side occupied by line 0.
 */
export const parseGridLayout = (
  startingGrid: string | undefined,
  cars: readonly GridColumnCandidate[] = []
): GridLayout | null => {
  const fromPace = columnsFromPaceLines(cars);
  if (fromPace !== null) {
    return { ...fromPace, poleSide: poleSideFromLabel(startingGrid) };
  }
  // The sim numbered a field and it is not the two-abreast one, so the label
  // cannot be used to describe what is standing on the track.
  if (hasNumberedGrid(cars)) return UNKNOWN_GRID;
  if (!startingGrid) return UNKNOWN_GRID;
  const match = COLUMN_PATTERN.exec(startingGrid);
  if (!match) return UNKNOWN_GRID;
  const columns = Number.parseInt(match[1], 10);
  if (!Number.isFinite(columns) || columns !== 2) return UNKNOWN_GRID;
  return {
    columns,
    poleSide: poleSideFromLabel(startingGrid),
    columnLateralM: COLUMN_LATERAL_M,
  };
};

/**
 * Where a grid line stands across the road, in metres to the driver's right.
 *
 * `columnLateralM` is the pitch between columns, not an offset from the
 * centreline: a two-abreast field stands its columns half a pitch either side
 * of the middle, so two cars abreast are one pitch apart. Reading the pitch as
 * the offset drew the whole field at twice its real width and left the player
 * two lanes from the car parked beside him.
 */
export const gridColumnLateralM = (
  line: number,
  layout: GridLayout
): number | null => {
  if (layout.columns < 2 || line < 0 || line >= layout.columns) return null;
  const lineDirection = layout.poleSide === 'left' ? 1 : -1;
  return (
    (line - (layout.columns - 1) / 2) * layout.columnLateralM * lineDirection
  );
};

/**
 * Puts every car of a two-column start into its configured lane.
 *
 * Candidates come from the sim's pace slots or, for standing starts, the
 * qualifying order. In both cases line 0 is the pole lane and the session's
 * `StartingGrid` label determines which side it occupies. The player's own row
 * is included too, even when `CarLeftRight` does not report an overlap there.
 */
export const assignGridColumns = (
  cars: readonly GridColumnCandidate[],
  layout: GridLayout
): Map<number, number> | null => {
  if (layout.columns < 2) return UNKNOWN_GRID;

  const columns = new Map<number, number>();
  for (const car of cars) {
    if (car.row < 0) continue;
    const lateralM = gridColumnLateralM(car.line, layout);
    if (lateralM === null) continue;
    columns.set(car.carIdx, lateralM);
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
