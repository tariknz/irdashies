/**
 * Counts how many times RadarDisplay paints. A snapshot used to paint twice —
 * once from useRadarMotion, once from RadarDisplay's layout effect — both
 * drawing the same interpolator buffers.
 */
import { act, render } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { RadarDisplay } from './RadarDisplay';
import type { RadarDisplayProps } from './RadarDisplay';
import type { RadarBlip } from '../radarBlips';

const blip = (over: Partial<RadarBlip> & { carIdx: number }): RadarBlip => {
  const lateralM = over.lateralM ?? 0.2;
  return {
    alongM: 11,
    lateralM,
    relYaw: 0,
    gapM: 11,
    side: null,
    rimSignal: null,
    carNumber: '24',
    isPaceCar: false,
    ...over,
    drawLateralM: over.drawLateralM ?? lateralM,
  };
};

const props = {
  blips: [blip({ carIdx: 1 })],
  radarRange: 100,
  vehicleWidth: 2,
  vehicleLength: 4.5,
  showCarNumbers: true,
  colorRival: '#cbd5e1',
  colorPlayer: '#2fd16a',
  playerLateralM: 0,
  viewMode: 'top',
  rearCameraTilt: 30,
  bgOpacity: 30,
  sideIndicatorStyle: 'double-arc',
  sideIndicatorColor: '#f59e0b',
  sideIndicatorOpacity: 80,
  sideIndicatorEnabled: true,
  trackLengthM: 5000,
  showFollowingMap: false,
  followingMapPath: new Float64Array([]),
  followingMapPointCount: 0,
  followingMapWindowM: 90,
  followingMapBorderColor: '#334155',
  followingMapBorderOpacity: 80,
  followingMapFillColor: '#64748b',
  followingMapFillOpacity: 45,
} satisfies Omit<RadarDisplayProps, 'nowSeconds'>;

const observers: ((entries: unknown) => void)[] = [];
let paints = 0;

beforeEach(() => {
  observers.length = 0;
  paints = 0;
  const methods: Record<string, unknown> = {};
  const noop = () => undefined;
  const context = new Proxy({} as Record<string, unknown>, {
    get: (_t, name: string) => {
      // clearRect runs once per paint; the gradient is cached across paints, so
      // it cannot be used to count them.
      if (name === 'clearRect') {
        return () => {
          paints += 1;
        };
      }
      if (name === 'createRadialGradient') {
        return () => ({ addColorStop: noop });
      }
      return methods[name] ?? noop;
    },
    set: () => true,
  });
  vi.stubGlobal(
    'ResizeObserver',
    class {
      constructor(cb: (entries: unknown) => void) {
        observers.push(cb);
      }
      observe() {
        /* size is delivered by deliverSize */
      }
      disconnect() {
        /* nothing to tear down */
      }
    }
  );
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(
    () => context as unknown as RenderingContext
  );
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

const deliverSize = (width: number, height: number) =>
  act(() => {
    for (const o of observers) o([{ contentRect: { width, height } }]);
  });

describe('paint accounting', () => {
  it('paints a snapshot once, and still repaints for a resize', () => {
    const { rerender } = render(React.createElement(RadarDisplay, props));
    deliverSize(300, 300);
    expect(paints).toBe(1);

    // A telemetry snapshot: a new blips array. One paint, not two.
    rerender(
      React.createElement(RadarDisplay, {
        ...props,
        blips: [blip({ carIdx: 1, alongM: 12 })],
      })
    );
    expect(paints).toBe(2);

    // A resize arrives as a commit that leaves the blips alone, so it is a
    // repaint reason in its own right.
    deliverSize(320, 300);
    expect(paints).toBe(3);
  });
});
