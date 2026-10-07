import { SessionState, TrackLocation } from '@irdashies/types';

/** iRacing's PaceMode telemetry values. */
export const PaceMode = {
  SingleFileStart: 0,
  DoubleFileStart: 1,
  SingleFileRestart: 2,
  DoubleFileRestart: 3,
  NotPacing: 4,
} as const;

export interface GridOptions {
  standingStart: boolean;
  /**
   * Cars per grid row: 1 for single file, 2 for "2x2". A standing grid is
   * staggered two wide even when the session says single file, so fewer
   * than two only matters for the pace line.
   */
  columns: number;
  /** Side of the pole column as the sim describes it. */
  poleSide: 'left' | 'right';
}

/**
 * `WeekendOptions.StartingGrid` reads like "2x2 inline pole on left" or
 * "single file". Anything unrecognised falls back to two wide, pole left,
 * which is what nearly every series runs.
 */
export const parseStartingGrid = (
  raw: string | undefined
): Pick<GridOptions, 'columns' | 'poleSide'> => {
  const text = raw?.toLowerCase() ?? '';
  const wide = /(\d+)\s*x\s*\d+/.exec(text);
  const columns = text.includes('single file')
    ? 1
    : wide
      ? Math.max(1, parseInt(wide[1], 10))
      : 2;
  const poleSide = /pole on right/.test(text) ? 'right' : 'left';
  return { columns, poleSide };
};

export interface FormationInput {
  focus: number;
  /** Signed metres from the focus car for each car index; NaN if unknown. */
  dists: readonly number[];
  pcts: readonly number[];
  surfaces: readonly number[];
  onPitRoad: readonly boolean[];
  excluded: ReadonlySet<number>;
  paceMode: number;
  paceLines: readonly number[];
  paceRows: readonly number[];
  sessionState: number;
  /** Per car speed along the track in m/s. */
  speeds: readonly number[];
  /** Below this speed, in m/s, a car counts as parked in its grid box. */
  gridMaxSpeedMs?: number;
  /** CarIdxLapCompleted: -1 until a car first crosses the line. */
  lapsCompleted: readonly number[];
  paceCarIdx: number;
  grid: GridOptions;
}

export interface Formation {
  kind: 'grid' | 'pace';
  /**
   * Per car, its column (grid) or line (pace) minus ours, counted away from
   * the pole side. Multiply by the pole side's sign to get a lane.
   */
  slots: Map<number, number>;
  /** The car to line up behind while pacing; null when not pacing. */
  followCarIdx: number | null;
}

/** Faster than this and the field is moving, not sitting on the grid. */
const DEFAULT_GRID_MAX_SPEED_MS = 3;

const GRIDDED_STATES: ReadonlySet<number> = new Set([
  SessionState.GetInCar,
  SessionState.Warmup,
  SessionState.ParadeLaps,
]);

const at = (values: readonly number[], index: number) => values[index] ?? -1;

/** Closer than this, two still cars cannot both be in grid boxes. */
const MIN_BOX_GAP_M = 3;
/** A gap further than this share of a box from a whole number is not one. */
const MAX_BOX_ERROR = 0.25;

/**
 * Boxes between each pair of neighbours down the grid, or null when the gaps
 * do not fit one box spacing. The spacing is the shortest gap, since that is
 * one box wherever two neighbouring boxes are filled: a median goes wrong
 * while the grid fills up and most gaps span empty boxes. A grid with no two
 * neighbours filled at all still reads as full; distances cannot tell.
 */
const boxSteps = (gaps: readonly number[]): number[] | null => {
  const plausible = gaps.filter((gap) => gap >= MIN_BOX_GAP_M);
  if (plausible.length === 0) return gaps.length === 0 ? [] : null;
  // Not refitted over all gaps: a refit bends towards a gap that is no whole
  // number of boxes until it passes. Recorded grids sit within 0.2 m, so the
  // error carried down long gaps stays far below the limit.
  const spacing = Math.min(...plausible);
  const steps = gaps.map((gap) => Math.max(1, Math.round(gap / spacing)));
  const fits = gaps.every(
    (gap, index) => Math.abs(gap / spacing - steps[index]) <= MAX_BOX_ERROR
  );
  return fits ? steps : null;
};

/**
 * Works out where each car sits in a structured formation, when there is
 * one: behind the pace car (rolling start, caution, restart), or on a
 * standing-start grid.
 *
 * Pacing is read straight from the sim's pace line and row. A standing grid
 * has no pace data until the start, so columns come from where the cars
 * actually sit: grid boxes are staggered at an even spacing and alternate
 * sides, so a car's box number down the grid gives its column. Counting
 * boxes rather than cars keeps an empty box from swapping every column
 * behind it, and qualifying order would miss cars moved to pit lane.
 */
export const computeFormation = (input: FormationInput): Formation | null =>
  pacingFormation(input) ?? gridFormation(input);

const pacingFormation = (input: FormationInput): Formation | null => {
  const { focus, paceLines, paceRows, paceMode } = input;
  const myLine = at(paceLines, focus);
  const myRow = at(paceRows, focus);
  // PaceMode alone stays "double file start" well into some races; only
  // assigned lines mean the field is actually in formation.
  if (paceMode === PaceMode.NotPacing || myLine < 0) return null;

  const double =
    paceMode === PaceMode.DoubleFileStart ||
    paceMode === PaceMode.DoubleFileRestart;
  const slots = new Map<number, number>();
  let followCarIdx: number | null = null;
  for (let carIdx = 0; carIdx < paceLines.length; carIdx += 1) {
    const line = at(paceLines, carIdx);
    if (line < 0 || carIdx === focus) continue;
    slots.set(carIdx, double ? line - myLine : 0);
    if (
      myRow > 0 &&
      at(paceRows, carIdx) === myRow - 1 &&
      (!double || line === myLine)
    ) {
      followCarIdx = carIdx;
    }
  }
  if (myRow === 0 && input.paceCarIdx >= 0) followCarIdx = input.paceCarIdx;
  return { kind: 'pace', slots, followCarIdx };
};

/**
 * The sim already reports Racing while the lights are still red, so the grid
 * also holds until the focus car first crosses the line.
 */
const onGrid = (input: FormationInput): boolean => {
  if (GRIDDED_STATES.has(input.sessionState)) return true;
  return (
    input.sessionState === SessionState.Racing &&
    (input.lapsCompleted[input.focus] ?? 0) < 0
  );
};

const isStill = (input: FormationInput, carIdx: number) =>
  Math.abs(input.speeds[carIdx] ?? 0) <=
  (input.gridMaxSpeedMs ?? DEFAULT_GRID_MAX_SPEED_MS);

const gridFormation = (input: FormationInput): Formation | null => {
  const { focus, grid } = input;
  if (
    !grid.standingStart ||
    !onGrid(input) ||
    !isStill(input, focus) ||
    input.onPitRoad[focus] === true
  ) {
    return null;
  }

  const gridded: number[] = [];
  for (let carIdx = 0; carIdx < input.pcts.length; carIdx += 1) {
    if (
      input.excluded.has(carIdx) ||
      at(input.pcts, carIdx) < 0 ||
      input.onPitRoad[carIdx] === true ||
      at(input.surfaces, carIdx) !== TrackLocation.OnTrack ||
      !Number.isFinite(input.dists[carIdx]) ||
      !isStill(input, carIdx)
    ) {
      continue;
    }
    gridded.push(carIdx);
  }
  if (!gridded.includes(focus)) return null;

  // Front of the grid first.
  gridded.sort((a, b) => input.dists[b] - input.dists[a] || a - b);
  const gaps = gridded
    .slice(1)
    .map((carIdx, index) => input.dists[gridded[index]] - input.dists[carIdx]);
  const steps = boxSteps(gaps);
  // Columns we cannot trust are worse than none: the field still counts as
  // on the grid, but lanes come from the spotter alone.
  if (!steps) return { kind: 'grid', slots: new Map(), followCarIdx: null };
  const boxes: number[] = [0];
  steps.forEach((step, index) => boxes.push(boxes[index] + step));

  const columns = Math.max(2, grid.columns);
  const columnOf = (rank: number) => boxes[rank] % columns;
  const myColumn = columnOf(gridded.indexOf(focus));
  const slots = new Map<number, number>();
  gridded.forEach((carIdx, rank) => {
    if (carIdx !== focus) slots.set(carIdx, columnOf(rank) - myColumn);
  });
  return { kind: 'grid', slots, followCarIdx: null };
};
