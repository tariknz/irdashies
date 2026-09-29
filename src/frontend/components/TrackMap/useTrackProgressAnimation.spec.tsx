import { act, render } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  progressToFlatX,
  useTrackProgressAnimation,
} from './useTrackProgressAnimation';

import { progressToTrackPoint } from '@irdashies/domain/trackGeometry';
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

describe('useTrackProgressAnimation', () => {
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
      useTrackProgressAnimation(stableDrivers.current, () => drawCount++);
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
      useTrackProgressAnimation(stableDrivers.current, () => undefined);
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
      useTrackProgressAnimation(stableDrivers.current, () => undefined);
      return null;
    };

    const view = render(<Harness progress={0.1} />);
    view.rerender(<Harness progress={0.3} />);
    view.unmount();

    expect(cancelAnimationFrame).toHaveBeenCalled();
  });
});
