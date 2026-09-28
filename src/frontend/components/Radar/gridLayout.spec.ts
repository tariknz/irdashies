import { describe, expect, it } from 'vitest';
import { SessionState } from '@irdashies/types';
import {
  assignGridColumns,
  isGridBeforeStart,
  parseGridLayout,
  type GridColumnCandidate,
  type GridLayout,
} from './gridLayout';

/** The grid label iRacing actually ships, and the one shape we draw. */
const TWO_ABREAST = '2x2 inline pole on left';

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
  /** A car as the sim numbered it: `row` counts from the front of the field. */
  const at = (
    carIdx: number,
    row: number,
    line: number
  ): GridColumnCandidate => ({ carIdx, row, line });

  it('puts each car in the column the sim names', () => {
    const columns = assignGridColumns([at(1, 3, 0), at(2, 3, 1)], layout);
    expect(columns?.get(1)).toBe(-layout.columnLateralM);
    expect(columns?.get(2)).toBe(layout.columnLateralM);
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
      expect(columns?.get(row * 2)).toBe(-layout.columnLateralM);
      expect(columns?.get(row * 2 + 1)).toBe(layout.columnLateralM);
    }
  });

  it('leaves the row beside the player to the sim', () => {
    // The player's own row is drawn from the CarLeftRight verdict, which knows
    // the side for the player's own car. Here the player is car 9 in row 4.
    const columns = assignGridColumns(
      [at(8, 4, 0), at(9, 4, 1), at(10, 5, 0), at(11, 5, 1)],
      layout,
      4
    );
    expect(columns?.has(8)).toBe(false);
    expect(columns?.has(9)).toBe(false);
    expect(columns?.get(10)).toBe(-layout.columnLateralM);
    expect(columns?.get(11)).toBe(layout.columnLateralM);
  });

  it('places a row that is short of a car', () => {
    // A car whose partner retired still stands in a column the sim named, so
    // the one that is there is drawn where it is rather than dropped. This is
    // the case a distance reconstruction could not answer at all.
    const columns = assignGridColumns([at(1, 2, 1)], layout);
    expect(columns?.get(1)).toBe(layout.columnLateralM);
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
    expect(columns?.get(1)).toBe(-layout.columnLateralM);
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
