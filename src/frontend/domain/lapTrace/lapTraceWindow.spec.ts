import { describe, it, expect } from 'vitest';
import {
  VIEW_WIDTH,
  carXForWindow,
  createWindowPieces,
  windowPieces,
  xForMetres,
} from './lapTraceWindow';

const TRACK_LENGTH_M = 5000;
const METERS_BEHIND = 200;
const METERS_AHEAD = 200;

describe('xForMetres', () => {
  it('pins the car to the centre of the plot when the split is even', () => {
    expect(xForMetres(1234, 1234, METERS_BEHIND, METERS_AHEAD)).toBe(
      VIEW_WIDTH / 2
    );
    expect(xForMetres(0, 0, METERS_BEHIND, METERS_AHEAD)).toBe(VIEW_WIDTH / 2);
  });

  it('places the window edges at the plot edges', () => {
    expect(
      xForMetres(1000 - METERS_BEHIND, 1000, METERS_BEHIND, METERS_AHEAD)
    ).toBe(0);
    expect(
      xForMetres(1000 + METERS_AHEAD, 1000, METERS_BEHIND, METERS_AHEAD)
    ).toBe(VIEW_WIDTH);
  });

  it('shifts the car away from the midpoint when the split is uneven', () => {
    // 100 m behind, 600 m ahead: the car sits at 100/700 of the width.
    const x = xForMetres(1000, 1000, 100, 600);
    expect(x).toBeCloseTo((100 / 700) * VIEW_WIDTH, 5);
    expect(x).toBeLessThan(VIEW_WIDTH / 2);
  });

  it('does not divide by zero before the window size is known', () => {
    expect(xForMetres(100, 0, 0, 0)).toBe(VIEW_WIDTH / 2);
  });
});

describe('carXForWindow', () => {
  it('centres the car when behind equals ahead', () => {
    expect(carXForWindow(200, 200)).toBe(VIEW_WIDTH / 2);
  });

  it('moves the car toward the smaller side', () => {
    expect(carXForWindow(100, 600)).toBeCloseTo((100 / 700) * VIEW_WIDTH, 5);
    expect(carXForWindow(600, 100)).toBeCloseTo((600 / 700) * VIEW_WIDTH, 5);
  });

  it('does not divide by zero before the window size is known', () => {
    expect(carXForWindow(0, 0)).toBe(VIEW_WIDTH / 2);
  });
});

describe('windowPieces', () => {
  const pieces = (
    carDistanceM: number,
    behind = METERS_BEHIND,
    ahead = METERS_AHEAD
  ) => {
    const out = createWindowPieces();
    const count = windowPieces(
      carDistanceM,
      behind,
      ahead,
      TRACK_LENGTH_M,
      out
    );
    return out.slice(0, count);
  };

  it('is a single piece of this lap mid-lap', () => {
    expect(pieces(1000)).toEqual([{ fromM: 800, toM: 1200, offsetM: 0 }]);
  });

  it('supports an uneven split', () => {
    expect(pieces(1000, 100, 600)).toEqual([
      { fromM: 900, toM: 1600, offsetM: 0 },
    ]);
  });

  it('reaches back into the previous lap while sitting on the line', () => {
    expect(pieces(0)).toEqual([
      {
        fromM: TRACK_LENGTH_M - 200,
        toM: TRACK_LENGTH_M,
        offsetM: -TRACK_LENGTH_M,
      },
      { fromM: 0, toM: 200, offsetM: 0 },
    ]);
  });

  it('reaches forward into the next lap while approaching the line', () => {
    expect(pieces(TRACK_LENGTH_M - 1)).toEqual([
      { fromM: TRACK_LENGTH_M - 201, toM: TRACK_LENGTH_M, offsetM: 0 },
      { fromM: 0, toM: 199, offsetM: TRACK_LENGTH_M },
    ]);
  });

  it('returns nothing for a degenerate window or lap', () => {
    const out = createWindowPieces();
    expect(windowPieces(100, 0, 0, TRACK_LENGTH_M, out)).toBe(0);
    expect(windowPieces(100, 200, 200, 0, out)).toBe(0);
  });

  it('never allocates: writes into the caller-owned pieces', () => {
    const out = createWindowPieces();
    const first = out[0];
    windowPieces(1000, METERS_BEHIND, METERS_AHEAD, TRACK_LENGTH_M, out);
    windowPieces(0, METERS_BEHIND, METERS_AHEAD, TRACK_LENGTH_M, out);
    expect(out[0]).toBe(first);
  });
});

describe('the start/finish seam', () => {
  // The whole point of the pieces: x must keep increasing across the seam
  // while the data wraps, or the path snaps back on itself.
  const assertTiling = (carDistanceM: number) => {
    const out = createWindowPieces();
    const count = windowPieces(
      carDistanceM,
      METERS_BEHIND,
      METERS_AHEAD,
      TRACK_LENGTH_M,
      out
    );
    expect(count).toBeGreaterThan(0);

    let previousX = Number.NEGATIVE_INFINITY;
    let previousEnd: number | null = null;
    for (let i = 0; i < count; i++) {
      const piece = out[i];
      const xFrom = xForMetres(
        piece.fromM + piece.offsetM,
        carDistanceM,
        METERS_BEHIND,
        METERS_AHEAD
      );
      const xTo = xForMetres(
        piece.toM + piece.offsetM,
        carDistanceM,
        METERS_BEHIND,
        METERS_AHEAD
      );
      expect(xFrom).toBeGreaterThanOrEqual(previousX);
      expect(xTo).toBeGreaterThan(xFrom);
      previousX = xTo;
      // Adjacent pieces meet exactly: no gap, no overlap.
      if (previousEnd !== null) {
        expect(piece.fromM + piece.offsetM).toBe(previousEnd);
      }
      previousEnd = piece.toM + piece.offsetM;
    }
    // The pieces cover the whole window.
    expect(out[0].fromM + out[0].offsetM).toBe(carDistanceM - METERS_BEHIND);
    expect(previousEnd).toBe(carDistanceM + METERS_AHEAD);
  };

  it('tiles the window while sitting on the line', () => {
    assertTiling(0);
  });

  it('tiles the window approaching the line', () => {
    assertTiling(TRACK_LENGTH_M - 1);
  });

  it('tiles the window mid-lap', () => {
    assertTiling(2500);
  });
});
