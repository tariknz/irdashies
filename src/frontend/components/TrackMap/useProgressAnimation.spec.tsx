import { act, cleanup, render } from '@testing-library/react';
import { StrictMode, useLayoutEffect, useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ProgressInterpolator,
  progressToFlatX,
  progressToTrackPoint,
  useProgressAnimation,
} from './useProgressAnimation';

describe('ProgressInterpolator', () => {
  it('interpolates normal movement', () => {
    const interpolator = new ProgressInterpolator(40);
    interpolator.setTargets([{ progress: 0.1 }], 0);
    interpolator.setTargets([{ progress: 0.3 }], 0);

    expect(interpolator.advance(20)).toBe(true);
    expect(interpolator.getValues()[0]).toBeCloseTo(0.2);
  });

  it('uses the shortest wrapped path across start/finish', () => {
    const interpolator = new ProgressInterpolator(40);
    interpolator.setTargets([{ progress: 0.99 }], 0);
    interpolator.setTargets([{ progress: 0.01 }], 0);

    interpolator.advance(20);
    expect(interpolator.getValues()[0]).toBeCloseTo(0);
    interpolator.advance(40);
    expect(interpolator.getValues()[0]).toBeCloseTo(0.01);
  });

  it('settles after one position interval', () => {
    const interpolator = new ProgressInterpolator(40);
    interpolator.setTargets([{ progress: 0.2 }], 0);
    interpolator.setTargets([{ progress: 0.4 }], 0);

    expect(interpolator.advance(39)).toBe(true);
    expect(interpolator.advance(40)).toBe(false);
    expect(interpolator.getValues()[0]).toBeCloseTo(0.4);
  });

  it('adapts interpolation to the observed snapshot cadence', () => {
    const interpolator = new ProgressInterpolator();
    interpolator.setTargets([{ progress: 0.1 }], 0);
    interpolator.setTargets([{ progress: 0.3 }], 50);

    expect(interpolator.advance(75)).toBe(true);
    expect(interpolator.getValues()[0]).toBeCloseTo(0.2);
    expect(interpolator.advance(100)).toBe(false);
  });

  it('reuses its output collection throughout the frame path', () => {
    const interpolator = new ProgressInterpolator(40);
    interpolator.setTargets([{ progress: 0.1 }, { progress: 0.2 }], 0);
    const output = interpolator.getValues();

    for (let now = 0; now <= 40; now++) {
      interpolator.advance(now);
      expect(interpolator.getValues()).toBe(output);
    }
  });

  it('preserves existing drivers by CarIdx when the roster changes', () => {
    const interpolator = new ProgressInterpolator(40);
    interpolator.setTargets(
      [
        { progress: 0.1, driver: { CarIdx: 7 } },
        { progress: 0.5, driver: { CarIdx: 3 } },
      ],
      0
    );
    interpolator.setTargets(
      [
        { progress: 0.7, driver: { CarIdx: 3 } },
        { progress: 0.9, driver: { CarIdx: 9 } },
      ],
      0
    );

    expect(interpolator.getValues()[0]).toBeCloseTo(0.5);
    expect(interpolator.getValues()[1]).toBeCloseTo(0.9);
    expect(interpolator.getCount()).toBe(2);
  });
});

describe('map projection', () => {
  it('projects interpolated progress onto the curved map in place', () => {
    const output = { x: 0, y: 0 };
    progressToTrackPoint(
      0.5,
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
      ],
      100,
      0,
      'anticlockwise',
      output
    );

    expect(output).toEqual({ x: 50, y: 0 });
  });

  it('projects interpolated progress onto the flat map', () => {
    expect(progressToFlatX(0.5, 40, 200)).toBe(140);
  });
});

describe('useProgressAnimation', () => {
  let callbacks: Map<number, FrameRequestCallback>;
  let nextFrameId: number;
  let now: number;

  const frame = (time: number) => {
    now = time;
    const pending = [...callbacks.values()];
    callbacks.clear();
    act(() => pending.forEach((callback) => callback(time)));
  };
  const commitAt = (time: number) => {
    now = time;
  };
  const drivers = (progress: number) => [{ progress, driver: { CarIdx: 7 } }];

  beforeEach(() => {
    callbacks = new Map();
    nextFrameId = 0;
    now = 0;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callbacks.set(++nextFrameId, callback);
      return nextFrameId;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
  });

  afterEach(() => {
    cleanup();
    delete window.rendererPerfBridge;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('coalesces multiple position commits into one frame using the latest data', () => {
    const draw = vi.fn();
    const Harness = ({ source }: { source: ReturnType<typeof drivers> }) => {
      useProgressAnimation(source, draw);
      return null;
    };
    const view = render(<Harness source={drivers(0.1)} />);
    draw.mockClear();
    commitAt(5);
    view.rerender(<Harness source={drivers(0.2)} />);
    commitAt(10);
    view.rerender(<Harness source={drivers(0.3)} />);
    expect(draw).not.toHaveBeenCalled();
    expect(callbacks.size).toBe(1);
    frame(20);
    expect(draw).toHaveBeenCalledTimes(1);
    expect(draw.mock.calls[0][0][0]).toBeGreaterThan(0.1);
    expect(draw.mock.calls[0][0][0]).toBeLessThan(0.3);
    frame(40);
    expect(draw.mock.calls.at(-1)?.[0][0]).toBeCloseTo(0.3);
    expect(callbacks.size).toBe(0);
  });

  it('keeps interpolating each uncapped frame and stops when settled without React renders', () => {
    let renders = 0;
    const values: number[] = [];
    const Harness = ({ source }: { source: ReturnType<typeof drivers> }) => {
      renders++;
      useProgressAnimation(source, (progress) => values.push(progress[0]));
      return null;
    };
    const view = render(<Harness source={drivers(0.1)} />);
    view.rerender(<Harness source={drivers(0.3)} />);
    frame(10);
    frame(20);
    frame(40);
    expect(values).toEqual([0.1, 0.15, 0.2, 0.3]);
    expect(callbacks.size).toBe(0);
    expect(renders).toBe(2);
  });

  it('does not restart the cap on every position commit', () => {
    const draw = vi.fn();
    const Harness = ({ source }: { source: ReturnType<typeof drivers> }) => {
      useProgressAnimation(source, draw, 30);
      return null;
    };
    const view = render(<Harness source={drivers(0.1)} />);
    draw.mockClear();
    commitAt(5);
    view.rerender(<Harness source={drivers(0.3)} />);
    frame(16);
    commitAt(25);
    view.rerender(<Harness source={drivers(0.4)} />);
    frame(32);
    expect(draw).not.toHaveBeenCalled();
    frame(34);
    expect(draw).toHaveBeenCalledTimes(1);
    expect(callbacks.size).toBe(1);
  });

  it('uses the latest committed appearance in an already pending frame', () => {
    const oldDraw = vi.fn();
    const latestDraw = vi.fn();
    const Harness = ({
      source,
      draw,
    }: {
      source: ReturnType<typeof drivers>;
      draw: typeof oldDraw;
    }) => {
      useProgressAnimation(source, draw);
      return null;
    };
    const view = render(<Harness source={drivers(0.1)} draw={oldDraw} />);
    view.rerender(<Harness source={drivers(0.3)} draw={oldDraw} />);
    oldDraw.mockClear();
    view.rerender(<Harness source={drivers(0.4)} draw={latestDraw} />);
    expect(latestDraw).not.toHaveBeenCalled();
    frame(20);
    expect(oldDraw).not.toHaveBeenCalled();
    expect(latestDraw).toHaveBeenCalledTimes(1);
  });

  it('repaints appearance-only commits immediately while idle or animating', () => {
    const draw = vi.fn();
    const source = drivers(0.1);
    const Harness = ({
      source,
      appearance,
    }: {
      source: ReturnType<typeof drivers>;
      appearance: string;
    }) => {
      useProgressAnimation(source, (values) => draw(appearance, values[0]));
      return null;
    };
    const view = render(<Harness source={source} appearance="old" />);
    view.rerender(<Harness source={source} appearance="new" />);
    expect(draw.mock.calls.at(-1)).toEqual(['new', 0.1]);
    expect(callbacks.size).toBe(0);
    const moving = drivers(0.3);
    view.rerender(<Harness source={moving} appearance="new" />);
    frame(10);
    commitAt(20);
    view.rerender(<Harness source={moving} appearance="latest" />);
    expect(draw.mock.calls.at(-1)?.[0]).toBe('latest');
    expect(draw.mock.calls.at(-1)?.[1]).toBeCloseTo(0.2);
    frame(40);
    expect(draw.mock.calls.at(-1)).toEqual(['latest', 0.3]);
    expect(callbacks.size).toBe(0);
  });

  it('restores a canvas cleared by an earlier layout effect even with a new snapshot and a cap', () => {
    let canvas = '';
    const Harness = ({
      source,
      revision,
    }: {
      source: ReturnType<typeof drivers>;
      revision: number;
    }) => {
      const invalidated = useRef(false);
      useLayoutEffect(() => {
        canvas = '';
        invalidated.current = true;
      }, [revision]);
      useProgressAnimation(
        source,
        () => {
          canvas = `cars:${revision}`;
        },
        30,
        invalidated
      );
      return null;
    };
    const view = render(<Harness source={drivers(0.1)} revision={0} />);
    expect(canvas).toBe('cars:0');
    commitAt(5);
    view.rerender(<Harness source={drivers(0.3)} revision={1} />);
    expect(canvas).toBe('cars:1');
    frame(16);
    expect(canvas).toBe('cars:1');
  });

  it('paints a nonmoving roster update once, then stays idle', () => {
    const draw = vi.fn();
    const Harness = ({ source }: { source: ReturnType<typeof drivers> }) => {
      useProgressAnimation(source, draw);
      return null;
    };
    const view = render(<Harness source={drivers(0.1)} />);
    view.rerender(<Harness source={[]} />);
    frame(16);
    expect(draw.mock.calls.at(-1)?.[1]).toBe(0);
    expect(callbacks.size).toBe(0);
    view.rerender(<Harness source={drivers(0.9)} />);
    frame(32);
    expect(draw.mock.calls.at(-1)?.[0][0]).toBeCloseTo(0.9);
    expect(callbacks.size).toBe(0);
  });

  it('records draw work and cancels pending work on unmount including StrictMode', () => {
    const recordMeasure = vi.fn();
    window.rendererPerfBridge = { recordMeasure };
    const draw = vi.fn();
    const Harness = ({
      source,
      cap,
    }: {
      source: ReturnType<typeof drivers>;
      cap?: number;
    }) => {
      useProgressAnimation(source, draw, cap);
      return null;
    };
    const view = render(
      <StrictMode>
        <Harness source={drivers(0.1)} />
      </StrictMode>
    );
    view.rerender(
      <StrictMode>
        <Harness source={drivers(0.3)} />
      </StrictMode>
    );
    expect(callbacks.size).toBe(1);
    frame(16);
    expect(recordMeasure).toHaveBeenCalledWith(
      'trackMapAnimationFrame',
      expect.any(Number)
    );
    view.rerender(
      <StrictMode>
        <Harness source={drivers(0.4)} cap={30} />
      </StrictMode>
    );
    expect(callbacks.size).toBe(1);
    view.unmount();
    expect(callbacks.size).toBe(0);
    draw.mockClear();
    frame(100);
    expect(draw).not.toHaveBeenCalled();
  });
});
