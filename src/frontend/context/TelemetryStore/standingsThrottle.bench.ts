import { act, cleanup, renderHook } from '@testing-library/react';
import { bench, describe, vi } from 'vitest';
import {
  useTelemetryStore,
  useTelemetryValuesRounded,
  useTelemetryValuesThrottled,
} from './TelemetryStore';
import type { Telemetry } from '@irdashies/types';

/**
 * Wall-clock companion to standingsThrottle.perf.spec.ts. That test proves
 * render counts; this measures the actual time cost of driving the same
 * simulated race through each subscription strategy, including a stand-in
 * for the Standings recompute work each render triggers (sort + map over
 * the grid), since fewer renders only matters if the work they trigger is
 * non-trivial — which createStandings' grouping/sorting/iRating pass is.
 *
 * Run with: npx vitest bench src/frontend/context/TelemetryStore/standingsThrottle.bench.ts
 */
const CAR_COUNT = 24;
const TICK_MS = 1000 / 60;
const TICK_COUNT = 120; // shorter than the perf spec — bench repeats this many times per round

const buildTelemetry = (lapDistPct: number[]): Telemetry =>
  ({ CarIdxLapDistPct: { value: lapDistPct } }) as Telemetry;

const tickDeltas = Array.from(
  { length: CAR_COUNT },
  (_, carIdx) => 0.005 + (carIdx % 5) * 0.003
);

/** Stand-in for createStandings' per-render work: sort + map over the grid. */
const simulateStandingsRecompute = (lapDistPct: number[]) =>
  lapDistPct
    .map((pct, carIdx) => ({ carIdx, pct }))
    .sort((a, b) => b.pct - a.pct);

describe('Standings telemetry subscription cost: rounding vs throttling', () => {
  bench('before — useTelemetryValuesRounded(key, 3)', () => {
    vi.useFakeTimers();
    useTelemetryStore
      .getState()
      .setTelemetry(buildTelemetry(new Array(CAR_COUNT).fill(0)));
    const lapDistPct = new Array(CAR_COUNT).fill(0);

    renderHook(() => {
      const values = useTelemetryValuesRounded('CarIdxLapDistPct', 3);
      simulateStandingsRecompute(values);
      return values;
    });

    for (let tick = 0; tick < TICK_COUNT; tick++) {
      for (let carIdx = 0; carIdx < CAR_COUNT; carIdx++) {
        lapDistPct[carIdx] = (lapDistPct[carIdx] + tickDeltas[carIdx]) % 1;
      }
      act(() => {
        useTelemetryStore
          .getState()
          .setTelemetry(buildTelemetry([...lapDistPct]));
        vi.advanceTimersByTime(TICK_MS);
      });
    }
    vi.useRealTimers();
    cleanup();
  });

  bench('after — useTelemetryValuesThrottled(key, 66)', () => {
    vi.useFakeTimers();
    useTelemetryStore
      .getState()
      .setTelemetry(buildTelemetry(new Array(CAR_COUNT).fill(0)));
    const lapDistPct = new Array(CAR_COUNT).fill(0);

    renderHook(() => {
      const values = useTelemetryValuesThrottled('CarIdxLapDistPct', 66);
      simulateStandingsRecompute(values);
      return values;
    });

    for (let tick = 0; tick < TICK_COUNT; tick++) {
      for (let carIdx = 0; carIdx < CAR_COUNT; carIdx++) {
        lapDistPct[carIdx] = (lapDistPct[carIdx] + tickDeltas[carIdx]) % 1;
      }
      act(() => {
        useTelemetryStore
          .getState()
          .setTelemetry(buildTelemetry([...lapDistPct]));
        vi.advanceTimersByTime(TICK_MS);
      });
    }
    vi.useRealTimers();
    cleanup();
  });
});
