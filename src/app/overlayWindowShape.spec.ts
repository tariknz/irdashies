import { describe, expect, it, vi } from 'vitest';
import {
  buildOverlayWindowShape,
  OverlayWindowShape,
} from './overlayWindowShape';

describe('buildOverlayWindowShape', () => {
  it('excludes the gap between distant widgets while preserving effect padding', () => {
    const shape = buildOverlayWindowShape(
      [
        { x: 100, y: 100, width: 200, height: 100 },
        { x: 1100, y: 700, width: 300, height: 200 },
      ],
      { x: 80, y: 80, width: 1340, height: 840 },
      20
    );
    expect(shape).toEqual([
      { x: 0, y: 0, width: 240, height: 140 },
      { x: 1000, y: 600, width: 340, height: 240 },
    ]);
    expect(
      shape.some(
        (r) =>
          500 >= r.x &&
          500 < r.x + r.width &&
          300 >= r.y &&
          300 < r.y + r.height
      )
    ).toBe(false);
  });

  it('uses logical coordinates on a negative-origin display and rounds outwards', () => {
    expect(
      buildOverlayWindowShape(
        [{ x: -1850.4, y: -150.3, width: 100.2, height: 80.1 }],
        { x: -1900, y: -200, width: 500, height: 300 },
        20
      )
    ).toEqual([{ x: 29, y: 29, width: 141, height: 121 }]);
  });

  it('clips regions to the actual window size and drops invalid/offscreen layouts', () => {
    expect(
      buildOverlayWindowShape(
        [
          { x: -10, y: -10, width: 100, height: 100 },
          { x: 290, y: 190, width: 80, height: 80 },
          { x: 500, y: 500, width: 20, height: 20 },
          { x: NaN, y: 10, width: 100, height: 100 },
          { x: 10, y: 10, width: 0, height: 100 },
        ],
        { x: 0, y: 0, width: 300, height: 200 },
        20
      )
    ).toEqual([
      { x: 0, y: 0, width: 110, height: 110 },
      { x: 270, y: 170, width: 30, height: 30 },
    ]);
  });
});

describe('OverlayWindowShape', () => {
  const rectangles = [{ x: 10, y: 20, width: 100, height: 80 }];

  it.each(['win32', 'linux'] as const)(
    'applies and clears the region on %s',
    (platform) => {
      const window = { setShape: vi.fn() };
      const shape = new OverlayWindowShape(platform, vi.fn());
      shape.apply(window, rectangles);
      shape.apply(window, []);
      expect(window.setShape.mock.calls).toEqual([[rectangles], [[]]]);
    }
  );

  it('leaves unsupported platforms alone', () => {
    const window = { setShape: vi.fn() };
    new OverlayWindowShape('darwin', vi.fn()).apply(window, rectangles);
    expect(window.setShape).not.toHaveBeenCalled();
  });

  it('avoids native repaints for unchanged geometry but applies to a replacement window', () => {
    const shape = new OverlayWindowShape('win32', vi.fn());
    const first = { setShape: vi.fn() };
    const replacement = { setShape: vi.fn() };
    shape.apply(first, rectangles);
    shape.apply(
      first,
      rectangles.map((rect) => ({ ...rect }))
    );
    shape.apply(replacement, rectangles);
    expect(first.setShape).toHaveBeenCalledOnce();
    expect(replacement.setShape).toHaveBeenCalledOnce();
  });

  it('restores a rectangle after failure and reports the failure once per window', () => {
    const error = new Error('native region failed');
    const window = {
      setShape: vi.fn().mockImplementationOnce(() => {
        throw error;
      }),
    };
    const warn = vi.fn();
    const shape = new OverlayWindowShape('win32', warn);
    shape.apply(window, rectangles);
    shape.apply(window, []);
    shape.apply(window, rectangles);
    expect(window.setShape.mock.calls).toEqual([[rectangles], [[]]]);
    expect(warn).toHaveBeenCalledExactlyOnceWith(error);
  });

  it('does not propagate failure when even clearing the native region fails', () => {
    const window = {
      setShape: vi.fn(() => {
        throw new Error('window gone');
      }),
    };
    const warn = vi.fn();
    expect(() =>
      new OverlayWindowShape('win32', warn).apply(window, rectangles)
    ).not.toThrow();
    expect(warn).toHaveBeenCalledOnce();
  });
});
