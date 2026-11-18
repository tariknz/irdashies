import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { RadarDisplay, type RadarDisplayProps } from './RadarDisplay';
import { radarStyleFrom } from '../radarStyle';
import { getWidgetDefaultConfig } from '@irdashies/types';

const draw = vi.hoisted(() => vi.fn());
vi.mock('../radarDraw', async (original) => ({
  ...(await original<typeof import('../radarDraw')>()),
  drawRadar: draw,
}));
vi.mock('@irdashies/domain/widgetPresentation/WidgetScale', () => ({
  useWidgetScale: () => 1,
}));

const props: RadarDisplayProps = {
  frame: { playerPct: 0, playerSpeed: 50, trackLength: 5000, cars: [] },
  appearance: new Map(),
  geometry: null,
  style: radarStyleFrom(
    getWidgetDefaultConfig('radar'),
    { length: 4.5, width: 1.9 },
    true
  ),
};

describe('Radar painting cadence', () => {
  let now: number;
  let nextId: number;
  let pending: Map<number, FrameRequestCallback>;
  const recordMeasure = vi.fn();

  beforeEach(() => {
    now = 0;
    nextId = 0;
    pending = new Map();
    draw.mockClear();
    recordMeasure.mockClear();
    vi.spyOn(performance, 'now').mockImplementation(() => now);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
      setTransform: vi.fn(),
    } as unknown as CanvasRenderingContext2D);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        constructor(private callback: ResizeObserverCallback) {}
        observe() {
          this.callback(
            [
              { contentRect: { width: 200, height: 200 } },
            ] as ResizeObserverEntry[],
            this as unknown as ResizeObserver
          );
        }
        disconnect() {
          return undefined;
        }
        unobserve() {
          return undefined;
        }
      }
    );
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      pending.set(++nextId, callback);
      return nextId;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => pending.delete(id));
    window.rendererPerfBridge = { recordMeasure };
  });
  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete window.rendererPerfBridge;
    delete window.windowVisibilityBridge;
  });

  const refresh = (time: number, callbackDelay = 0) => {
    now = time + callbackDelay;
    const callbacks = [...pending.values()];
    pending.clear();
    act(() => callbacks.forEach((callback) => callback(time)));
  };

  it.each([60, 120, 144, 240])(
    'paints about 60 times per second on a %i Hz display',
    (hz) => {
      render(<RadarDisplay {...props} />);
      for (let index = 1; index <= hz; index++) refresh((index * 1000) / hz);
      // Includes the initial synchronous paint.
      expect(draw).toHaveBeenCalledTimes(61);
      expect(recordMeasure).toHaveBeenCalledTimes(61);
      expect(recordMeasure).toHaveBeenLastCalledWith(
        'radarFrame',
        expect.any(Number)
      );
    }
  );

  it.each([59.94, 60])(
    'keeps pace at %s Hz when animation callbacks have varying delays',
    (hz) => {
      // Mount between refreshes, then vary callback delivery independently
      // of the browser's animation-frame timestamp.
      now = 0.2;
      render(<RadarDisplay {...props} />);
      for (let index = 1; index <= 600; index++) {
        refresh((index * 1000) / hz, index % 2 ? 0.4 : 0);
      }
      // The first refresh can precede the initial paint's deadline.
      expect(draw.mock.calls.length).toBeGreaterThanOrEqual(600);
      expect(draw.mock.calls.length).toBeLessThanOrEqual(601);
    }
  );

  it('keeps pace when fractional refresh timestamps straddle a deadline', () => {
    render(<RadarDisplay {...props} />);
    for (let index = 1; index <= 600; index++) {
      refresh((index * 1000) / 59.94 + (index % 2 ? 0.2 : -0.2));
    }
    // A few refreshes can fall before the deadline, but its phase must not
    // reset after each miss and lock painting to every other refresh.
    expect(draw.mock.calls.length).toBeGreaterThanOrEqual(590);
    expect(draw.mock.calls.length).toBeLessThanOrEqual(601);
  });

  it('paints each available frame below 60 Hz without catch-up bursts', () => {
    render(<RadarDisplay {...props} />);
    for (let index = 1; index <= 30; index++) refresh((index * 1000) / 30);
    expect(draw).toHaveBeenCalledTimes(31);
    refresh(5000);
    expect(draw).toHaveBeenCalledTimes(32);
    expect(pending.size).toBe(1);
  });

  it('skips missed paint slots after a stall without a catch-up burst', () => {
    render(<RadarDisplay {...props} />);
    refresh(5001);
    expect(draw).toHaveBeenCalledTimes(2);
    refresh(5001 + 1000 / 240);
    refresh(5001 + 2000 / 240);
    expect(draw).toHaveBeenCalledTimes(2);
    refresh(5001 + 4000 / 240);
    expect(draw).toHaveBeenCalledTimes(3);
    expect(pending.size).toBe(1);
  });

  it('cancels animation while inactive and on unmount', () => {
    const view = render(<RadarDisplay {...props} />);
    expect(pending.size).toBe(1);
    view.rerender(<RadarDisplay {...props} active={false} />);
    expect(pending.size).toBe(0);
    view.rerender(<RadarDisplay {...props} />);
    expect(pending.size).toBe(1);
    view.unmount();
    expect(pending.size).toBe(0);
  });

  it('stops native-hidden work even when document visibility stays visible and resumes immediately', () => {
    let onVisible: ((visible: boolean) => void) | undefined;
    const unsubscribe = vi.fn();
    window.windowVisibilityBridge = {
      onVisibilityChanged: (callback) => {
        onVisible = callback;
        return unsubscribe;
      },
    };
    const view = render(<RadarDisplay {...props} />);
    expect(pending.size).toBe(1);
    const before = draw.mock.calls.length;
    act(() => onVisible?.(false));
    expect(pending.size).toBe(0);
    refresh(1000);
    expect(draw).toHaveBeenCalledTimes(before);
    view.rerender(
      <RadarDisplay
        {...props}
        frame={{ ...props.frame, playerSpeed: 60, playerPct: 0.5 }}
      />
    );
    expect(draw).toHaveBeenCalledTimes(before);
    act(() => onVisible?.(true));
    expect(draw).toHaveBeenCalledTimes(before + 1);
    expect(draw.mock.calls.at(-1)?.[1].playerPct).toBeCloseTo(0.5);
    expect(pending.size).toBe(1);
    view.unmount();
    expect(unsubscribe).toHaveBeenCalledOnce();
  });

  it('draws the latest snapshot on the next due paint without resetting the clock', () => {
    const view = render(<RadarDisplay {...props} />);
    refresh(5);
    view.rerender(
      <RadarDisplay {...props} frame={{ ...props.frame, playerSpeed: 60 }} />
    );
    expect(draw).toHaveBeenCalledOnce();
    refresh(17);
    expect(draw).toHaveBeenCalledTimes(2);
    expect(draw.mock.calls.at(-1)?.[1].playerPct).toBeGreaterThan(0);
  });
});
