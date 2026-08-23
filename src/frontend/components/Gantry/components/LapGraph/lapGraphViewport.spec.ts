import { describe, expect, it } from 'vitest';
import {
  DEFAULT_WINDOW_LAPS,
  MIN_WINDOW_LAPS,
  brushToWindow,
  brushXToLap,
  centreWindowOn,
  clampWindow,
  defaultWindow,
  followWindow,
  isWindowLive,
  lapToX,
  nearestLapAtX,
  panWindow,
  stepWindow,
  windowSpan,
  windowToBrush,
  xToLap,
  zoomWindow,
} from './lapGraphViewport';

const bounds = { minLap: 1, maxLap: 500 };

describe('clampWindow', () => {
  it('keeps a window that already fits', () => {
    expect(clampWindow({ start: 100, end: 200 }, bounds)).toEqual({
      start: 100,
      end: 200,
    });
  });

  it('slides a window that runs past the end, keeping its span', () => {
    const clamped = clampWindow({ start: 480, end: 580 }, bounds);

    expect(clamped.end).toBe(500);
    expect(windowSpan(clamped)).toBe(100);
  });

  it('slides a window that runs before the start', () => {
    const clamped = clampWindow({ start: -40, end: 60 }, bounds);

    expect(clamped.start).toBe(1);
    expect(windowSpan(clamped)).toBe(100);
  });

  it('never zooms tighter than the minimum span', () => {
    expect(windowSpan(clampWindow({ start: 10, end: 11 }, bounds))).toBe(
      MIN_WINDOW_LAPS
    );
  });

  it('never zooms wider than the race', () => {
    expect(clampWindow({ start: -900, end: 900 }, bounds)).toEqual({
      start: 1,
      end: 500,
    });
  });

  it('collapses to a point when only one lap exists', () => {
    expect(
      clampWindow({ start: 1, end: 60 }, { minLap: 4, maxLap: 4 })
    ).toEqual({
      start: 4,
      end: 4,
    });
  });

  it('survives non-finite input', () => {
    const clamped = clampWindow(
      { start: Number.NaN, end: Number.POSITIVE_INFINITY },
      bounds
    );

    expect(Number.isFinite(clamped.start)).toBe(true);
    expect(Number.isFinite(clamped.end)).toBe(true);
  });

  it('accepts bounds given the wrong way round', () => {
    expect(clampWindow({ start: 1, end: 5 }, { minLap: 9, maxLap: 2 })).toEqual(
      {
        start: 2,
        end: 7,
      }
    );
  });
});

describe('defaultWindow', () => {
  it('shows the most recent laps of a long race', () => {
    const window = defaultWindow(bounds);

    expect(window.end).toBe(500);
    expect(windowSpan(window)).toBe(DEFAULT_WINDOW_LAPS);
  });

  it('shows the whole race when it is shorter than the default', () => {
    expect(defaultWindow({ minLap: 1, maxLap: 12 })).toEqual({
      start: 1,
      end: 12,
    });
  });
});

describe('followWindow', () => {
  it('pins the right edge to the newest lap without changing zoom', () => {
    const followed = followWindow({ start: 100, end: 150 }, bounds);

    expect(followed.end).toBe(500);
    expect(windowSpan(followed)).toBe(50);
  });

  it('is idempotent', () => {
    const once = followWindow({ start: 100, end: 150 }, bounds);

    expect(followWindow(once, bounds)).toEqual(once);
  });
});

describe('isWindowLive', () => {
  it('is live when the window ends on the newest lap', () => {
    expect(isWindowLive({ start: 425, end: 500 }, bounds)).toBe(true);
  });

  it('is not live once the user pans away', () => {
    expect(isWindowLive({ start: 100, end: 175 }, bounds)).toBe(false);
  });
});

describe('zoomWindow', () => {
  it('keeps the anchor lap under the cursor when zooming in', () => {
    const before = { start: 100, end: 200 };
    const anchor = 175;
    const ratioBefore = (anchor - before.start) / windowSpan(before);

    const after = zoomWindow(before, bounds, 0.5, anchor);
    const ratioAfter = (anchor - after.start) / windowSpan(after);

    expect(windowSpan(after)).toBe(50);
    expect(ratioAfter).toBeCloseTo(ratioBefore, 6);
  });

  it('zooms out to the whole race and stops there', () => {
    let window = { start: 200, end: 260 };
    for (let i = 0; i < 20; i++) window = zoomWindow(window, bounds, 2, 230);

    expect(window).toEqual({ start: 1, end: 500 });
  });

  it('zooms in to the minimum span and stops there', () => {
    let window = { start: 1, end: 500 };
    for (let i = 0; i < 40; i++) window = zoomWindow(window, bounds, 0.5, 250);

    expect(windowSpan(window)).toBe(MIN_WINDOW_LAPS);
  });

  it('ignores a nonsense factor', () => {
    expect(zoomWindow({ start: 100, end: 200 }, bounds, 0, 150)).toEqual({
      start: 100,
      end: 200,
    });
  });
});

describe('panWindow', () => {
  it('moves the window by the requested laps', () => {
    expect(panWindow({ start: 100, end: 200 }, bounds, 25)).toEqual({
      start: 125,
      end: 225,
    });
  });

  it('stops at the end instead of running off the data', () => {
    const panned = panWindow({ start: 400, end: 500 }, bounds, 999);

    expect(panned).toEqual({ start: 400, end: 500 });
  });
});

describe('stepWindow', () => {
  it('steps one lap right', () => {
    expect(stepWindow({ start: 100, end: 200 }, bounds, 1)).toEqual({
      start: 101,
      end: 201,
    });
  });

  it('steps one lap left', () => {
    expect(stepWindow({ start: 100, end: 200 }, bounds, -1)).toEqual({
      start: 99,
      end: 199,
    });
  });
});

describe('x scale', () => {
  const window = { start: 100, end: 200 };

  it('round-trips a lap through the scale', () => {
    expect(xToLap(lapToX(137, window, 1000), window, 1000)).toBeCloseTo(137, 6);
  });

  it('puts the window start on the left edge', () => {
    expect(lapToX(100, window, 1000)).toBe(0);
    expect(lapToX(200, window, 1000)).toBe(1000);
  });

  it('centres a single-lap window instead of dividing by zero', () => {
    expect(lapToX(4, { start: 4, end: 4 }, 800)).toBe(400);
  });

  it('clamps the hit-test lap to the visible window', () => {
    expect(nearestLapAtX(-500, window, 1000, bounds)).toBe(100);
    expect(nearestLapAtX(5000, window, 1000, bounds)).toBe(200);
  });

  it('never returns a lap the race has not reached', () => {
    expect(
      nearestLapAtX(999, { start: 1, end: 6 }, 1000, { minLap: 1, maxLap: 6 })
    ).toBe(6);
  });
});

describe('brush', () => {
  it('places the window proportionally on the strip', () => {
    const rect = windowToBrush({ start: 250.5, end: 500 }, bounds, 499);

    expect(rect.x).toBeCloseTo(249.5, 6);
    expect(rect.width).toBeCloseTo(249.5, 6);
  });

  it('round-trips a drag back to a window', () => {
    const rect = windowToBrush({ start: 100, end: 200 }, bounds, 499);
    const window = brushToWindow(rect.x, rect.x + rect.width, bounds, 499);

    expect(window.start).toBeCloseTo(100, 6);
    expect(window.end).toBeCloseTo(200, 6);
  });

  it('normalises a right-to-left drag', () => {
    expect(brushToWindow(400, 100, bounds, 499)).toEqual(
      brushToWindow(100, 400, bounds, 499)
    );
  });

  it('applies the minimum span to a tiny drag', () => {
    expect(windowSpan(brushToWindow(200, 201, bounds, 499))).toBe(
      MIN_WINDOW_LAPS
    );
  });
});

describe('centreWindowOn', () => {
  it('centres on the lap and keeps the span', () => {
    const centred = centreWindowOn({ start: 0, end: 100 }, bounds, 300);

    expect(centred).toEqual({ start: 250, end: 350 });
  });

  it('clamps at the edges', () => {
    expect(centreWindowOn({ start: 0, end: 100 }, bounds, 1)).toEqual({
      start: 1,
      end: 101,
    });
  });
});

describe('brushXToLap', () => {
  const bounds = { minLap: 0, maxLap: 100 };

  it('maps a pointer position to the lap under it', () => {
    expect(brushXToLap(100, bounds, 200)).toBeCloseTo(50, 6);
  });

  it('does not slide the lap away near the right edge', () => {
    // Reading this back out of a zero-width window used to return a lap up to a
    // whole minimum span early, so a click near the end jumped short.
    expect(brushXToLap(200, bounds, 200)).toBeCloseTo(100, 6);
  });

  it('clamps a pointer dragged outside the strip', () => {
    expect(brushXToLap(-50, bounds, 200)).toBe(0);
    expect(brushXToLap(500, bounds, 200)).toBe(100);
  });

  it('survives a zero-width strip', () => {
    expect(brushXToLap(10, bounds, 0)).toBe(0);
  });
});
