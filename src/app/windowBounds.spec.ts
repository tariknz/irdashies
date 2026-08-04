import { describe, expect, it } from 'vitest';
import {
  MIN_VISIBLE_HEIGHT,
  MIN_VISIBLE_WIDTH,
  intersection,
  isReachable,
  sanitizeWindowBounds,
  type Rect,
} from './windowBounds';

// Mirrors a real multi-monitor arrangement: a primary display at the origin
// with monitors to its left, so off-screen coordinates are negative.
const PRIMARY: Rect = { x: 0, y: 0, width: 2048, height: 1152 };
const LEFT: Rect = { x: -2048, y: 0, width: 2048, height: 1152 };
const FAR_LEFT: Rect = { x: -5488, y: 0, width: 3440, height: 1440 };
const DISPLAYS = [FAR_LEFT, LEFT, PRIMARY];

describe('intersection', () => {
  it('returns the overlapping rectangle', () => {
    expect(
      intersection(
        { x: 0, y: 0, width: 100, height: 100 },
        { x: 50, y: 50, width: 100, height: 100 }
      )
    ).toEqual({ x: 50, y: 50, width: 50, height: 50 });
  });

  it('returns null for disjoint rectangles', () => {
    expect(
      intersection(
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 100, y: 100, width: 10, height: 10 }
      )
    ).toBeNull();
  });

  it('returns null for rectangles that only share an edge', () => {
    expect(
      intersection(
        { x: 0, y: 0, width: 10, height: 10 },
        { x: 10, y: 0, width: 10, height: 10 }
      )
    ).toBeNull();
  });
});

describe('isReachable', () => {
  it('accepts a window fully inside a display', () => {
    expect(
      isReachable({ x: 100, y: 100, width: 800, height: 700 }, DISPLAYS)
    ).toBe(true);
  });

  it('accepts a window on a negative-coordinate display', () => {
    expect(
      isReachable({ x: -1114, y: 250, width: 801, height: 702 }, DISPLAYS)
    ).toBe(true);
  });

  it('accepts a window straddling two displays', () => {
    expect(
      isReachable({ x: -200, y: 100, width: 800, height: 700 }, DISPLAYS)
    ).toBe(true);
  });

  it('rejects a window entirely off every display', () => {
    expect(
      isReachable({ x: -20000, y: 250, width: 801, height: 702 }, DISPLAYS)
    ).toBe(false);
  });

  it('rejects a window overlapping by only a narrow vertical strip', () => {
    // A 10px-wide sliver lands on the far-left display's LEFT edge — the only
    // outer edge in this arrangement, since the three displays are contiguous
    // and a window near an inner edge simply lands on the neighbour. Its area
    // (10 x 702) clears any sane area threshold, which is why the check is on
    // both dimensions rather than area.
    const slivered: Rect = {
      x: FAR_LEFT.x - 801 + 10,
      y: 100,
      width: 801,
      height: 702,
    };
    const overlap = intersection(slivered, FAR_LEFT);

    expect(overlap?.width).toBe(10);
    expect(overlap?.width).toBeLessThan(MIN_VISIBLE_WIDTH);
    expect((overlap as Rect).width * (overlap as Rect).height).toBeGreaterThan(
      MIN_VISIBLE_WIDTH * MIN_VISIBLE_HEIGHT
    );
    expect(isReachable(slivered, DISPLAYS)).toBe(false);
  });

  it('rejects a window overlapping by only a short horizontal strip', () => {
    const slivered: Rect = { x: 100, y: -702 + 10, width: 801, height: 702 };
    expect(intersection(slivered, PRIMARY)?.height).toBe(10);
    expect(isReachable(slivered, DISPLAYS)).toBe(false);
  });

  it('does not reject a window smaller than the minimum visible area', () => {
    const tiny: Rect = { x: 10, y: 10, width: 40, height: 20 };
    expect(tiny.width).toBeLessThan(MIN_VISIBLE_WIDTH);
    expect(tiny.height).toBeLessThan(MIN_VISIBLE_HEIGHT);
    expect(isReachable(tiny, DISPLAYS)).toBe(true);
  });
});

describe('sanitizeWindowBounds', () => {
  it('returns undefined when nothing was saved', () => {
    expect(sanitizeWindowBounds(undefined, DISPLAYS, PRIMARY)).toBeUndefined();
  });

  it('passes through bounds that are still reachable', () => {
    const saved: Rect = { x: -1114, y: 250, width: 801, height: 702 };
    expect(sanitizeWindowBounds(saved, DISPLAYS, PRIMARY)).toEqual(saved);
  });

  it('recovers a window left off-screen by a display change', () => {
    // The reported failure: bounds saved against a monitor that is no longer
    // connected, restored where no display covers them.
    const saved: Rect = { x: -1114, y: 250, width: 801, height: 702 };
    const result = sanitizeWindowBounds(saved, [PRIMARY], PRIMARY);

    expect(result).toBeDefined();
    expect(isReachable(result as Rect, [PRIMARY])).toBe(true);
    // Size is preserved; only the position moves.
    expect(result).toMatchObject({ width: 801, height: 702 });
  });

  it('centres the recovered window on the primary display', () => {
    const saved: Rect = { x: -20000, y: 250, width: 800, height: 700 };
    expect(sanitizeWindowBounds(saved, DISPLAYS, PRIMARY)).toEqual({
      x: (2048 - 800) / 2,
      y: (1152 - 700) / 2,
      width: 800,
      height: 700,
    });
  });

  it('shrinks a window larger than the primary display', () => {
    const saved: Rect = { x: -20000, y: 0, width: 4000, height: 3000 };
    expect(sanitizeWindowBounds(saved, DISPLAYS, PRIMARY)).toEqual({
      x: 0,
      y: 0,
      width: PRIMARY.width,
      height: PRIMARY.height,
    });
  });

  it.each([
    ['NaN x', { x: NaN, y: 0, width: 800, height: 700 }],
    ['infinite y', { x: 0, y: Infinity, width: 800, height: 700 }],
    ['zero width', { x: 0, y: 0, width: 0, height: 700 }],
    ['negative height', { x: 0, y: 0, width: 800, height: -700 }],
  ])('discards malformed bounds (%s)', (_label, saved) => {
    expect(
      sanitizeWindowBounds(saved as Rect, DISPLAYS, PRIMARY)
    ).toBeUndefined();
  });

  it('returns undefined when no displays are reported', () => {
    const saved: Rect = { x: 0, y: 0, width: 800, height: 700 };
    expect(sanitizeWindowBounds(saved, [], undefined)).toBeUndefined();
  });
});
