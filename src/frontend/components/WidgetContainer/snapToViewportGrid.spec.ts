import { describe, expect, it } from 'vitest';
import {
  snapLayoutPositionToViewportGrid,
  snapLayoutResizeToViewportGrid,
} from './snapToViewportGrid';

const bounds = {
  x: -1920,
  y: 0,
  width: 1920,
  height: 1080,
};

const options = { bounds };

describe('snapToViewportGrid', () => {
  it('snaps widget position to a viewport-derived grid', () => {
    expect(
      snapLayoutPositionToViewportGrid(
        { x: -1906, y: 17, width: 240, height: 120 },
        options
      ).layout
    ).toEqual({ x: -1910, y: 15, width: 240, height: 120 });
  });

  it('returns the original layout when display bounds are unavailable', () => {
    const layout = { x: 103, y: 56, width: 240, height: 120 };

    expect(snapLayoutPositionToViewportGrid(layout).layout).toBe(layout);
    expect(
      snapLayoutResizeToViewportGrid(layout, 'se', {}, 100, 50).layout
    ).toBe(layout);
  });

  it('returns the original layout when snapping is disabled', () => {
    const layout = { x: 103, y: 56, width: 240, height: 120 };

    expect(
      snapLayoutPositionToViewportGrid(layout, {
        bounds,
        disabled: true,
      }).layout
    ).toBe(layout);
    expect(
      snapLayoutResizeToViewportGrid(
        layout,
        'se',
        { bounds, disabled: true },
        100,
        50
      ).layout
    ).toBe(layout);
  });

  it('snaps east and south resize edges to the grid', () => {
    expect(
      snapLayoutResizeToViewportGrid(
        { x: -1800, y: 20, width: 157, height: 83 },
        'se',
        options,
        100,
        50
      ).layout
    ).toEqual({ x: -1800, y: 20, width: 160, height: 85 });
  });

  it('snaps west and north resize edges while preserving the far edge', () => {
    expect(
      snapLayoutResizeToViewportGrid(
        { x: -1813, y: 13, width: 253, height: 127 },
        'nw',
        options,
        100,
        50
      ).layout
    ).toEqual({ x: -1810, y: 15, width: 250, height: 125 });
  });

  it('honors minimum dimensions when a snapped resize edge crosses the limit', () => {
    expect(
      snapLayoutResizeToViewportGrid(
        { x: -1813, y: 13, width: 95, height: 43 },
        'nw',
        options,
        100,
        50
      ).layout
    ).toEqual({ x: -1818, y: 6, width: 100, height: 50 });
  });

  it('locks a dragged widget to the display edge after snapping to zero distance', () => {
    const first = snapLayoutPositionToViewportGrid(
      { x: -1916, y: 120, width: 240, height: 120 },
      options,
      {},
      1000
    );
    const second = snapLayoutPositionToViewportGrid(
      { x: -1912, y: 120, width: 240, height: 120 },
      options,
      first.state,
      1300
    );

    expect(first.layout.x).toBe(-1920);
    expect(second.layout.x).toBe(-1920);
  });

  it('does not edge-lock when the widget is outside the tight edge threshold', () => {
    const result = snapLayoutPositionToViewportGrid(
      { x: -1915, y: 120, width: 240, height: 120 },
      options,
      {},
      1000
    );

    expect(result.layout.x).toBe(-1910);
  });

  it('releases an edge lock when the widget keeps moving past the display edge', () => {
    const first = snapLayoutPositionToViewportGrid(
      { x: -1916, y: 120, width: 240, height: 120 },
      options,
      {},
      1000
    );
    const second = snapLayoutPositionToViewportGrid(
      { x: -1940, y: 120, width: 240, height: 120 },
      options,
      first.state,
      1100
    );

    expect(first.layout.x).toBe(-1920);
    expect(second.layout.x).toBe(-1940);
  });

  it('releases an edge lock after a small continued move past the display edge', () => {
    const first = snapLayoutPositionToViewportGrid(
      { x: -1916, y: 120, width: 240, height: 120 },
      options,
      {},
      1000
    );
    const second = snapLayoutPositionToViewportGrid(
      { x: -1927, y: 120, width: 240, height: 120 },
      options,
      first.state,
      1100
    );

    expect(first.layout.x).toBe(-1920);
    expect(second.layout.x).toBe(-1927);
  });

  it('temporarily bypasses vertical grid snapping after releasing an edge lock', () => {
    const first = snapLayoutPositionToViewportGrid(
      { x: -1800, y: 4, width: 240, height: 120 },
      options,
      {},
      1000
    );
    const second = snapLayoutPositionToViewportGrid(
      { x: -1800, y: -7, width: 240, height: 120 },
      options,
      first.state,
      1100
    );

    expect(first.layout.y).toBe(0);
    expect(second.layout.y).toBe(-7);
  });

  it('resumes grid snapping after the release bypass window', () => {
    const first = snapLayoutPositionToViewportGrid(
      { x: -1916, y: 120, width: 240, height: 120 },
      options,
      {},
      1000
    );
    const second = snapLayoutPositionToViewportGrid(
      { x: -1927, y: 120, width: 240, height: 120 },
      options,
      first.state,
      1100
    );
    const third = snapLayoutPositionToViewportGrid(
      { x: -1927, y: 120, width: 240, height: 120 },
      options,
      second.state,
      1400
    );

    expect(second.layout.x).toBe(-1927);
    expect(third.layout.x).toBe(-1930);
  });

  it('releases an edge lock after 400ms', () => {
    const first = snapLayoutPositionToViewportGrid(
      { x: -1916, y: 120, width: 240, height: 120 },
      options,
      {},
      1000
    );
    const second = snapLayoutPositionToViewportGrid(
      { x: -1912, y: 120, width: 240, height: 120 },
      options,
      first.state,
      1400
    );

    expect(first.layout.x).toBe(-1920);
    expect(second.layout.x).toBe(-1912);
  });

  it('locks a resized widget edge to zero distance', () => {
    const first = snapLayoutResizeToViewportGrid(
      { x: -1800, y: 120, width: 1797, height: 120 },
      'e',
      options,
      100,
      50,
      {},
      1000
    );
    const second = snapLayoutResizeToViewportGrid(
      { x: -1800, y: 120, width: 1792, height: 120 },
      'e',
      options,
      100,
      50,
      first.state,
      1300
    );

    expect(first.layout.width).toBe(1800);
    expect(second.layout.width).toBe(1800);
  });

  it('locks a dragged widget edge to a sibling widget edge', () => {
    const siblingLayouts = [{ x: -1500, y: 300, width: 300, height: 120 }];
    const first = snapLayoutPositionToViewportGrid(
      { x: -1743, y: 300, width: 240, height: 120 },
      { bounds, siblingLayouts },
      {},
      1000
    );
    const second = snapLayoutPositionToViewportGrid(
      { x: -1748, y: 300, width: 240, height: 120 },
      { bounds, siblingLayouts },
      first.state,
      1300
    );

    expect(first.layout.x + first.layout.width).toBe(-1500);
    expect(second.layout.x + second.layout.width).toBe(-1500);
  });

  it('does not lock to a sibling edge when the widgets are in different rows', () => {
    const siblingLayouts = [{ x: -1500, y: 700, width: 300, height: 120 }];
    const result = snapLayoutPositionToViewportGrid(
      { x: -1748, y: 300, width: 240, height: 120 },
      { bounds, siblingLayouts },
      {},
      1000
    );

    expect(result.layout.x + result.layout.width).toBe(-1510);
  });

  it('locks a resized widget edge to a sibling widget edge', () => {
    const siblingLayouts = [{ x: -1500, y: 300, width: 300, height: 120 }];
    const first = snapLayoutResizeToViewportGrid(
      { x: -1800, y: 300, width: 297, height: 120 },
      'e',
      { bounds, siblingLayouts },
      100,
      50,
      {},
      1000
    );
    const second = snapLayoutResizeToViewportGrid(
      { x: -1800, y: 300, width: 292, height: 120 },
      'e',
      { bounds, siblingLayouts },
      100,
      50,
      first.state,
      1300
    );

    expect(first.layout.x + first.layout.width).toBe(-1500);
    expect(second.layout.x + second.layout.width).toBe(-1500);
  });

  it('honors minimum width after locking a resized west edge', () => {
    const result = snapLayoutResizeToViewportGrid(
      { x: -1817, y: 300, width: 97, height: 120 },
      'w',
      options,
      100,
      50,
      {},
      1000
    );

    expect(result.layout).toEqual({
      x: -1820,
      y: 300,
      width: 100,
      height: 120,
    });
  });

  it('honors minimum height after locking a resized north edge', () => {
    const result = snapLayoutResizeToViewportGrid(
      { x: -1800, y: 3, width: 240, height: 47 },
      'n',
      options,
      100,
      50,
      {},
      1000
    );

    expect(result.layout).toEqual({
      x: -1800,
      y: 0,
      width: 240,
      height: 50,
    });
  });
});
