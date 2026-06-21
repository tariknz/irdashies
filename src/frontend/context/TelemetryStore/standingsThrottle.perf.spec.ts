import { act, renderHook } from '@testing-library/react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  useTelemetryStore,
  useTelemetryValuesRounded,
  useTelemetryValuesThrottled,
} from './TelemetryStore';
import type { Telemetry } from '@irdashies/types';

/**
 * Quantifies the Standings perf fix instead of eyeballing Task Manager.
 *
 * Simulates a 24-car grid at 60Hz for 6 simulated seconds (360 ticks) with
 * realistic per-car speed deltas on CarIdxLapDistPct, and counts how many
 * times each subscription strategy actually accepts a new value (the
 * render/recompute trigger for the Standings aggregation hooks):
 *
 * - "before": useTelemetryValuesRounded(key, 3) — value-based rounding
 * - "after":  useTelemetryValuesThrottled(key, 66) — time-based sampling
 *
 * Claim under test: with a full grid, some car crosses any reasonable
 * rounding threshold almost every tick, so rounding alone barely reduces
 * render count versus the raw 60Hz feed. The throttle should cap renders to
 * roughly simulatedDurationMs / intervalMs regardless of grid size/speed.
 */
const CAR_COUNT = 24;
const TICK_MS = 1000 / 60;
const TICK_COUNT = 360; // 6 simulated seconds

const buildTelemetry = (lapDistPct: number[]): Telemetry =>
  ({ CarIdxLapDistPct: { value: lapDistPct } }) as Telemetry;

/** Per-car per-tick movement: ~0.005-0.02 of the track per tick, matching
 * race-speed cars (200kph on a 5km track ≈ 0.011/tick). */
const tickDeltas = Array.from(
  { length: CAR_COUNT },
  (_, carIdx) => 0.005 + ((carIdx % 5) * 0.003) // varied speeds, all comfortably > 0.001
);

const driveSimulatedRace = (onTick: (lapDistPct: number[]) => void) => {
  const lapDistPct = new Array(CAR_COUNT).fill(0);
  for (let tick = 0; tick < TICK_COUNT; tick++) {
    for (let carIdx = 0; carIdx < CAR_COUNT; carIdx++) {
      lapDistPct[carIdx] = (lapDistPct[carIdx] + tickDeltas[carIdx]) % 1;
    }
    // Each tick flushed on its own — mirrors discrete IPC pushes from the
    // main process, not a batch of 360 updates collapsed into one render.
    act(() => {
      onTick([...lapDistPct]);
      vi.advanceTimersByTime(TICK_MS);
    });
  }
};

describe('Standings telemetry subscription: rounding vs throttling under realistic load', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    useTelemetryStore.getState().setTelemetry(buildTelemetry(new Array(CAR_COUNT).fill(0)));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('reports render counts for both strategies over the same simulated race', () => {
    let roundedRenders = 0;
    renderHook(() => {
      roundedRenders++;
      return useTelemetryValuesRounded('CarIdxLapDistPct', 3);
    });

    let throttledRenders = 0;
    renderHook(() => {
      throttledRenders++;
      return useTelemetryValuesThrottled('CarIdxLapDistPct', 66);
    });

    // Both hooks render once on mount before any ticks are driven.
    const initialRounded = roundedRenders;
    const initialThrottled = throttledRenders;

    driveSimulatedRace((lapDistPct) => {
      useTelemetryStore.getState().setTelemetry(buildTelemetry(lapDistPct));
    });

    const roundedTickRenders = roundedRenders - initialRounded;
    const throttledTickRenders = throttledRenders - initialThrottled;

    // eslint-disable-next-line no-console
    console.log(
      `[perf] ${TICK_COUNT} ticks @ 60Hz, ${CAR_COUNT} cars: ` +
        `rounded(3dp)=${roundedTickRenders} renders, throttled(66ms)=${throttledTickRenders} renders`
    );

    // "before": rounding barely throttles anything — some car crosses the
    // threshold on nearly every tick with a full moving grid.
    expect(roundedTickRenders).toBeGreaterThan(TICK_COUNT * 0.9);

    // "after": capped to roughly simulated-duration / interval, independent
    // of grid size or speed.
    const expectedThrottledRenders = (TICK_COUNT * TICK_MS) / 66;
    expect(throttledTickRenders).toBeLessThan(expectedThrottledRenders * 1.5);
    expect(throttledTickRenders).toBeLessThan(roundedTickRenders * 0.5);
  });
});
