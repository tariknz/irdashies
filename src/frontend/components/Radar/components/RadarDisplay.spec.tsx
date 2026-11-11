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
  });

  const refresh = (time: number) => {
    now = time;
    const callbacks = [...pending.values()];
    pending.clear();
    act(() => callbacks.forEach((callback) => callback(now)));
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

  it('paints each available frame below 60 Hz without catch-up bursts', () => {
    render(<RadarDisplay {...props} />);
    for (let index = 1; index <= 30; index++) refresh((index * 1000) / 30);
    expect(draw).toHaveBeenCalledTimes(31);
    refresh(5000);
    expect(draw).toHaveBeenCalledTimes(32);
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
