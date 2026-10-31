import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { InputTrace, type InputTraceProps } from './InputTrace';

const settings = {
  includeBrake: true,
  includeThrottle: true,
  includeClutch: true,
  includeSteer: true,
  includeAbs: true,
  absStyle: 'bar' as const,
};

const activeInput = {
  brake: 0.8,
  throttle: 0.6,
  clutch: 0.4,
  steer: Math.PI,
  brakeAbsActive: true,
};

const idleInput = {
  brake: 0,
  throttle: 0,
  clutch: 0,
  steer: 0,
  brakeAbsActive: false,
};

const paths = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('path'), (path) =>
    path.getAttribute('d')
  );

describe('InputTrace history', () => {
  let callbacks: Map<number, FrameRequestCallback>;
  let nextId: number;

  beforeEach(() => {
    callbacks = new Map();
    nextId = 0;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      const id = ++nextId;
      callbacks.set(id, callback);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => callbacks.delete(id));
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  const drawFrame = () => {
    act(() => {
      const pending = Array.from(callbacks.values());
      callbacks.clear();
      pending.forEach((callback) => callback(performance.now()));
    });
  };

  const trace = (input: InputTraceProps['input'], maxSamples: number) => (
    <InputTrace input={input} settings={{ ...settings, maxSamples }} />
  );

  it('retains history across updates until samples leave the circular buffer', () => {
    const existing = render(trace(activeInput, 40));
    drawFrame();

    existing.rerender(trace({ ...idleInput }, 40));
    drawFrame();
    const fresh = render(trace(idleInput, 40));
    drawFrame();

    // All channels, including ABS, retain the earlier active sample.
    expect(paths(existing.container)).not.toEqual(paths(fresh.container));
    expect(paths(existing.container).every((path) => path !== '')).toBe(true);

    for (let i = 1; i < 40; i++) {
      existing.rerender(trace({ ...idleInput }, 40));
      drawFrame();
    }

    expect(paths(existing.container)).toEqual(paths(fresh.container));
  });

  it.each([
    [40, 80],
    [80, 40],
  ])('resets all histories safely when resizing from %i to %i', (from, to) => {
    const existing = render(trace(activeInput, from));
    drawFrame();
    // Put the write position beyond the new capacity in the shrinking case.
    for (let i = 1; i < from - 5; i++) {
      existing.rerender(trace({ ...activeInput }, from));
      drawFrame();
    }

    existing.rerender(trace(idleInput, to));
    drawFrame();
    const fresh = render(trace(idleInput, to));
    drawFrame();

    const resizedPaths = paths(existing.container);
    expect(resizedPaths).toEqual(paths(fresh.container));
    expect(resizedPaths.join('')).not.toMatch(/NaN|Infinity/);

    // New samples still accumulate after the reset.
    existing.rerender(trace(activeInput, to));
    fresh.rerender(trace(activeInput, to));
    drawFrame();
    expect(paths(existing.container)).toEqual(paths(fresh.container));
  });

  it('keeps only the latest update before the next animation frame', () => {
    const existing = render(trace(activeInput, 40));
    existing.rerender(trace(idleInput, 40));
    expect(callbacks.size).toBe(1);
    drawFrame();

    const fresh = render(trace(idleInput, 40));
    drawFrame();
    expect(paths(existing.container)).toEqual(paths(fresh.container));
  });
});
