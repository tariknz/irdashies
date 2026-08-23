import { describe, expect, it } from 'vitest';
import {
  anchorInsideBounds,
  clampToBounds,
  placeVertically,
} from './tooltipPosition';

const BOUNDS = { width: 1000, height: 600 };
const SIZE = { width: 200, height: 40 };

describe('clampToBounds', () => {
  it('leaves a box that already fits where it is', () => {
    expect(clampToBounds({ left: 100, top: 100 }, SIZE, BOUNDS)).toEqual({
      left: 100,
      top: 100,
    });
  });

  it('pulls a box back inside the right and bottom edges', () => {
    expect(clampToBounds({ left: 980, top: 590 }, SIZE, BOUNDS)).toEqual({
      left: 792,
      top: 552,
    });
  });

  it('pulls a box back inside the left and top edges', () => {
    expect(clampToBounds({ left: -50, top: -50 }, SIZE, BOUNDS)).toEqual({
      left: 8,
      top: 8,
    });
  });
});

describe('placeVertically', () => {
  const anchor = { top: 300, bottom: 320 };

  it('sits above the anchor when asked and there is room', () => {
    expect(placeVertically(anchor, 40, 'top', 600)).toBe(252);
  });

  it('sits below the anchor when asked and there is room', () => {
    expect(placeVertically(anchor, 40, 'bottom', 600)).toBe(328);
  });

  it('flips below when there is no room above', () => {
    const highAnchor = { top: 4, bottom: 24 };

    expect(placeVertically(highAnchor, 40, 'top', 600)).toBe(32);
  });

  it('flips above when there is no room below', () => {
    const lowAnchor = { top: 560, bottom: 580 };

    expect(placeVertically(lowAnchor, 40, 'bottom', 600)).toBe(512);
  });
});

describe('anchorInsideBounds', () => {
  it('anchors to the top left in the top-left quadrant', () => {
    expect(anchorInsideBounds({ x: 100, y: 100 }, BOUNDS, 14)).toEqual({
      left: 114,
      top: 114,
    });
  });

  it('anchors to the bottom right in the bottom-right quadrant', () => {
    expect(anchorInsideBounds({ x: 900, y: 500 }, BOUNDS, 14)).toEqual({
      right: 114,
      bottom: 114,
    });
  });

  it('never anchors to an edge the pointer is closest to', () => {
    const corners = [
      { x: 0, y: 0 },
      { x: 1000, y: 0 },
      { x: 0, y: 600 },
      { x: 1000, y: 600 },
    ];

    for (const corner of corners) {
      const anchor = anchorInsideBounds(corner, BOUNDS, 14);
      expect(Object.values(anchor).every((value) => value >= 14)).toBe(true);
    }
  });
});
