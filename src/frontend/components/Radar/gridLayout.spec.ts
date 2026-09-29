import { describe, expect, it } from 'vitest';
import { SessionState } from '@irdashies/types';
import {
  assignGridColumns,
  columnsFromPaceLines,
  gridColumnLateralM,
  isGridBeforeStart,
  parseGridLayout,
  type GridColumnCandidate,
  type GridLayout,
} from './gridLayout';

/** The grid label iRacing actually ships, and the one shape we draw. */
const TWO_ABREAST = '2x2 inline pole on left';

/** A car as the sim numbered it: `row` counts from the front of the field. */
const at = (
  carIdx: number,
  row: number,
  line: number
): GridColumnCandidate => ({ carIdx, row, line });

describe('columnsFromPaceLines', () => {
  it('reads two columns off the sim numbering whatever the label says', () => {
    // A recorded Road Atlanta grid: the session reports "single file" while the
    // sim numbers twenty cars across ten rows in two lines. The label is what
    // the session is configured for; the line is where the cars are standing.
    const field = [0, 1, 2, 3, 4].flatMap((row) => [
      at(row * 2, row, 0),
      at(row * 2 + 1, row, 1),
    ]);
    expect(parseGridLayout('single file', field)?.columns).toBe(2);
  });

  it('agrees with the label on a grid the label describes', () => {
    // Nürburgring: "2x2 inline pole on left" and two lines. Both sources give
    // the same answer, so the label stays as the fallback.
    const field = [at(1, 0, 0), at(2, 0, 1), at(3, 1, 0), at(4, 1, 1)];
    expect(parseGridLayout(TWO_ABREAST, field)).toEqual(
      parseGridLayout(TWO_ABREAST)
    );
  });

  it('reports no grid when the sim numbered one line', () => {
    // A single-file grid numbers every car line 0, and there is nothing to pair.
    const field = [at(1, 0, 0), at(2, 1, 0), at(3, 2, 0)];
    expect(columnsFromPaceLines(field)).toBeNull();
  });

  it('reports no grid when a line was assigned but no row', () => {
    // A recorded Okayama session writes row 0 with line -1 for cars that are in
    // the session but not parked yet. Taking the row as a grid would put a
    // one-row field on the start line.
    expect(columnsFromPaceLines([at(1, 0, -1), at(2, 0, -1)])).toBeNull();
  });

  it('reports no grid when the sim numbered nothing at all', () => {
    expect(columnsFromPaceLines([])).toBeNull();
    expect(columnsFromPaceLines([at(1, -1, -1), at(2, -1, -1)])).toBeNull();
  });

  it('refuses a third column rather than inventing where it stands', () => {
    // A wider grid is a different drawing problem, and the line numbering says
    // nothing about which side of the road the extra column is on.
    const field = [at(1, 0, 0), at(2, 0, 1), at(3, 0, 2)];
    expect(columnsFromPaceLines(field)).toBeNull();
    // The label fallback still describes a two-column grid, so the field stays
    // off rather than being placed on a guess.
    expect(parseGridLayout(TWO_ABREAST, field)).toBeNull();
  });

  it('falls back to the label when the sim has numbered no field', () => {
    // Racing onward every row and line reads -1, and the label is all that is
    // left. The hook gates on the session state, so this only matters for a
    // frame where the sim is behind the state it reports.
    expect(parseGridLayout(TWO_ABREAST, [])?.columns).toBe(2);
  });
});

describe('parseGridLayout', () => {
  it('reads the two-abreast grid and its column spacing', () => {
    const layout = parseGridLayout(TWO_ABREAST);
    expect(layout?.columns).toBe(2);
    expect(layout?.columnLateralM).toBeGreaterThan(0);
  });

  it('takes only the column count, not which side the pole is on', () => {
    // Both labels describe the same field shape. The side is not read because
    // the sim's own line numbering says which side each car is on, which is a
    // better answer than one inferred from a label.
    expect(parseGridLayout('2x2 inline pole on right')).toEqual(
      parseGridLayout(TWO_ABREAST)
    );
  });

  it('reports an unknown grid rather than guessing', () => {
    // A layout the radar does not draw must leave the cars on the
    // centreline projection, which is what null means.
    expect(parseGridLayout(undefined)).toBeNull();
    expect(parseGridLayout('')).toBeNull();
    expect(parseGridLayout('1x1 inline pole on left')).toBeNull();
    expect(parseGridLayout('3x3 inline pole on left')).toBeNull();
    expect(parseGridLayout('single file')).toBeNull();
    expect(parseGridLayout('no numbers here')).toBeNull();
  });
});

describe('assignGridColumns', () => {
  // A layout the parser is known to accept, so the maths can be read without a
  // null check on every line.
  const layout = parseGridLayout(TWO_ABREAST) as GridLayout;

  it('stands the columns a lane pitch apart, either side of the middle', () => {
    // The reported bug: reading the pitch as an offset from the centreline drew
    // the field at twice its real width, and the player two lanes from the car
    // parked beside him. What a driver sees is the gap between the two cars.
    const left = gridColumnLateralM(0, layout) as number;
    const right = gridColumnLateralM(1, layout) as number;
    expect(left).toBeLessThan(0);
    expect(right).toBeGreaterThan(0);
    expect(right - left).toBeCloseTo(layout.columnLateralM, 6);
    expect(left).toBeCloseTo(-right, 6);
    expect(gridColumnLateralM(-1, layout)).toBeNull();
    expect(gridColumnLateralM(2, layout)).toBeNull();
  });

  it('puts each car in the column the sim names, on the side it names', () => {
    const columns = assignGridColumns([at(1, 3, 0), at(2, 3, 1)], layout);
    expect(columns?.get(1)).toBeLessThan(0);
    expect(columns?.get(2)).toBeGreaterThan(0);
  });

  it('places every row of the field, front row included', () => {
    // Row 0 is the front of the grid, so a placement that started from the
    // player's own row and walked outwards would miss it. Nothing here is
    // relative to the player any more.
    const cars = [0, 1, 2, 3].flatMap((row) => [
      at(row * 2, row, 0),
      at(row * 2 + 1, row, 1),
    ]);
    const columns = assignGridColumns(cars, layout);
    expect(columns?.size).toBe(8);
    for (const row of [0, 1, 2, 3]) {
      expect(columns?.get(row * 2)).toBe(columns?.get(0));
      expect(columns?.get(row * 2 + 1)).toBe(columns?.get(1));
    }
    // Every row stands the same pair of columns, one pitch apart.
    expect(
      (columns?.get(1) as number) - (columns?.get(0) as number)
    ).toBeCloseTo(layout.columnLateralM, 6);
  });

  it('places the player row from the same sim grid numbering', () => {
    const columns = assignGridColumns(
      [at(8, 4, 0), at(9, 4, 1), at(10, 5, 0)],
      layout
    );
    expect(columns?.get(8)).toBeLessThan(0);
    expect(columns?.get(9)).toBeGreaterThan(0);
    expect(columns?.get(10)).toBe(columns?.get(8));
  });

  it('places a row that is short of a car', () => {
    // A car whose partner retired still stands in a column the sim named, so
    // the one that is there is drawn where it is rather than dropped. This is
    // the case a distance reconstruction could not answer at all.
    const columns = assignGridColumns([at(1, 2, 1)], layout);
    expect(columns?.get(1)).toBe(gridColumnLateralM(1, layout));
  });

  it('ignores a car the sim has no grid slot for', () => {
    // -1 is the sim's "not on a grid" value: a car that is not running, or the
    // field once the session is racing. Drawing it from a stale row would put a
    // car somewhere it never was.
    expect(assignGridColumns([at(1, -1, -1)], layout)).toBeNull();
    expect(assignGridColumns([at(1, -1, 0)], layout)).toBeNull();
    expect(assignGridColumns([at(1, 2, -1)], layout)).toBeNull();
  });

  it('ignores a line the layout does not cover', () => {
    // A wider grid than the session advertised is a placement this will not
    // make, rather than a third column invented halfway down the field.
    const columns = assignGridColumns([at(1, 2, 0), at(2, 2, 2)], layout);
    expect(columns?.get(1)).toBe(gridColumnLateralM(0, layout));
    expect(columns?.has(2)).toBe(false);
  });

  it('reports no grid when the sim numbered nothing', () => {
    expect(assignGridColumns([], layout)).toBeNull();
  });
});

describe('isGridBeforeStart', () => {
  it('holds only while the cars are still parked', () => {
    expect(isGridBeforeStart(SessionState.GetInCar)).toBe(true);
    expect(isGridBeforeStart(SessionState.Warmup)).toBe(true);
    expect(isGridBeforeStart(SessionState.ParadeLaps)).toBe(true);
  });

  it('is off once the session is running or over', () => {
    expect(isGridBeforeStart(SessionState.Racing)).toBe(false);
    expect(isGridBeforeStart(SessionState.Checkered)).toBe(false);
    expect(isGridBeforeStart(SessionState.CoolDown)).toBe(false);
  });

  it('is off when the sim has reported no state at all', () => {
    // 0 is Invalid, and it is also what a frame without the variable reads
    // as. The radar must not reconstruct a grid it knows nothing about.
    expect(isGridBeforeStart(SessionState.Invalid)).toBe(false);
    expect(isGridBeforeStart(Number.NaN)).toBe(false);
  });
});
