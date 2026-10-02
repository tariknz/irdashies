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
  /** Cars per grid row: 1 for single file, 2 for "2x2". */
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
  /** Focus car speed in m/s. */
  focusSpeed: number;
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
const GRID_MAX_SPEED_MS = 3;

const GRIDDED_STATES: ReadonlySet<number> = new Set([
  SessionState.GetInCar,
  SessionState.Warmup,
  SessionState.ParadeLaps,
]);

const at = (values: readonly number[], index: number) => values[index] ?? -1;

/**
 * Works out where each car sits in a structured formation, when there is
 * one: behind the pace car (rolling start, caution, restart), or on a
 * standing-start grid.
 *
 * Pacing is read straight from the sim's pace line and row. A standing grid
 * has no pace data until the start, so columns come from the order the cars
 * actually sit in: grid slots alternate sides, and the sim closes up gaps
 * left by cars starting from pit road, so qualifying order would be wrong.
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

const gridFormation = (input: FormationInput): Formation | null => {
  const { focus, grid } = input;
  if (
    !grid.standingStart ||
    !GRIDDED_STATES.has(input.sessionState) ||
    input.focusSpeed > GRID_MAX_SPEED_MS ||
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
      !Number.isFinite(input.dists[carIdx])
    ) {
      continue;
    }
    gridded.push(carIdx);
  }
  if (!gridded.includes(focus)) return null;

  // Front of the grid first.
  gridded.sort((a, b) => input.dists[b] - input.dists[a] || a - b);
  const columnOf = (rank: number) => rank % Math.max(1, grid.columns);
  const myColumn = columnOf(gridded.indexOf(focus));
  const slots = new Map<number, number>();
  gridded.forEach((carIdx, rank) => {
    if (carIdx !== focus) slots.set(carIdx, columnOf(rank) - myColumn);
  });
  return { kind: 'grid', slots, followCarIdx: null };
};
