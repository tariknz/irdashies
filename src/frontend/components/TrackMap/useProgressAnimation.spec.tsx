import { act, render } from '@testing-library/react';
import { useRef } from 'react';
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
  let callbacks: FrameRequestCallback[];
  let nextFrameId: number;

  beforeEach(() => {
    callbacks = [];
    nextFrameId = 0;
    vi.spyOn(performance, 'now').mockReturnValue(0);
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callbacks.push(callback);
      return ++nextFrameId;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
  });

  afterEach(() => {
    delete window.rendererPerfBridge;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('stops RAF when settled without per-frame React renders', () => {
    let renderCount = 0;
    let drawCount = 0;

    const Harness = ({ progress }: { progress: number }) => {
      renderCount++;
      const stableDrivers = useRef([{ progress }]);
      if (stableDrivers.current[0].progress !== progress) {
        stableDrivers.current = [{ progress }];
      }
      useProgressAnimation(stableDrivers.current, () => drawCount++);
      return null;
    };

    const view = render(<Harness progress={0.1} />);
    view.rerender(<Harness progress={0.3} />);
    expect(callbacks).toHaveLength(1);
    expect(drawCount).toBe(2);

    act(() => callbacks.shift()?.(20));
    expect(callbacks).toHaveLength(1);
    act(() => callbacks.shift()?.(40));

    expect(callbacks).toHaveLength(0);
    expect(renderCount).toBe(2);
    expect(drawCount).toBeGreaterThan(2);
  });

  it('records RAF work in renderer performance metrics', () => {
    const recordMeasure = vi.fn();
    window.rendererPerfBridge = { recordMeasure };

    const Harness = ({ progress }: { progress: number }) => {
      const stableDrivers = useRef([{ progress }]);
      if (stableDrivers.current[0].progress !== progress) {
        stableDrivers.current = [{ progress }];
      }
      useProgressAnimation(stableDrivers.current, () => undefined);
      return null;
    };

    const view = render(<Harness progress={0.1} />);
    view.rerender(<Harness progress={0.3} />);
    act(() => callbacks.shift()?.(20));

    expect(recordMeasure).toHaveBeenCalledWith(
      'trackMapAnimationFrame',
      expect.any(Number)
    );
    delete window.rendererPerfBridge;
  });

  it('cancels an active frame on unmount', () => {
    const Harness = ({ progress }: { progress: number }) => {
      const stableDrivers = useRef([{ progress }]);
      if (stableDrivers.current[0].progress !== progress) {
        stableDrivers.current = [{ progress }];
      }
      useProgressAnimation(stableDrivers.current, () => undefined);
      return null;
    };

    const view = render(<Harness progress={0.1} />);
    view.rerender(<Harness progress={0.3} />);
    view.unmount();

    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
