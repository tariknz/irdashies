import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { StandingsWidgetSettings } from '@irdashies/types';
import { getWidgetDefaultConfig } from '@irdashies/types';
import { mountFixture } from '../../../testing/renderWithFixture';
import type { ReplayFixture } from '../../../testing/replayFixture';
import roadAmerica from '../../../../test-data/fixtures/multiclass-road-america.json';
import { useDriverStandings } from './useDriverStandings';

const fixture = roadAmerica as unknown as ReplayFixture;

const config = (
  overrides: Partial<StandingsWidgetSettings['config']> = {}
): StandingsWidgetSettings['config'] => ({
  ...(getWidgetDefaultConfig('standings') as StandingsWidgetSettings['config']),
  ...overrides,
});

const flatten = <T,>(grouped: [string, T[]][]): T[] =>
  grouped.flatMap(([, drivers]) => drivers);

/**
 * The standings assembly behind the Standings widget and Gantry. It groups by
 * class, slices the field down to what a widget shows, and augments with gap,
 * interval and position change — none of which was covered before.
 */
describe('class standings over a real multiclass field', () => {
  let harness: ReturnType<typeof mountFixture>;

  beforeEach(() => {
    harness = mountFixture(fixture);
  });

  it('groups the field into its three classes', () => {
    const { result } = renderHook(
      () => useDriverStandings(config(), { showAll: true }),
      { wrapper: harness.wrapper }
    );

    const names = result.current
      .map(([, drivers]) => drivers[0]?.carClass.name)
      .filter(Boolean);
    expect(new Set(names)).toEqual(new Set(['GTP', 'Dallara P217', 'IMSA23']));
  });

  it('puts every driver in exactly one class group', () => {
    const { result } = renderHook(
      () => useDriverStandings(config(), { showAll: true }),
      { wrapper: harness.wrapper }
    );

    const all = flatten(result.current);
    const carIdxs = all.map((d) => d.carIdx);
    expect(new Set(carIdxs).size).toBe(carIdxs.length);
    expect(all.length).toBeGreaterThan(50);
  });

  it('orders each class by class position', () => {
    const { result } = renderHook(
      () => useDriverStandings(config(), { showAll: true }),
      { wrapper: harness.wrapper }
    );

    for (const [, drivers] of result.current) {
      const positions = drivers
        .map((d) => d.classPosition)
        .filter((p): p is number => typeof p === 'number' && p > 0);
      const sorted = [...positions].sort((a, b) => a - b);
      expect(positions).toEqual(sorted);
    }
  });

  it('gives the class leader no gap and everyone behind a growing one', () => {
    const { result } = renderHook(
      () =>
        useDriverStandings(config({ gap: { enabled: true } }), {
          showAll: true,
        }),
      { wrapper: harness.wrapper }
    );

    let sawAGap = false;
    for (const [, drivers] of result.current) {
      if (drivers.length < 2) continue;
      // The class leader shows a dash rather than zero.
      expect(drivers[0].gap?.value).toBeUndefined();

      // Only cars on the lead lap can be compared this way. Once a car is laps
      // down its gap is dominated by the laps it has lost, and retirements sit
      // in the order on their last known position rather than a time.
      const leadLapGaps = drivers
        .slice(1)
        .filter((d) => (d.gap?.laps ?? 0) === 0)
        .map((d) => d.gap?.value)
        .filter((g): g is number => typeof g === 'number');
      if (leadLapGaps.length > 1) {
        sawAGap = true;
        // Gap is to the class leader, so it grows down the running order.
        const sorted = [...leadLapGaps].sort((a, b) => a - b);
        expect(leadLapGaps).toEqual(sorted);
      }
    }
    // Guards against the whole assertion passing because nothing computed.
    expect(sawAGap).toBe(true);
  });

  it('reports interval as the gap to the car ahead', () => {
    const { result } = renderHook(
      () =>
        useDriverStandings(
          config({
            gap: { enabled: true },
            interval: { enabled: true },
          }),
          { showAll: true }
        ),
      { wrapper: harness.wrapper }
    );

    const intervals = flatten(result.current)
      .map((d) => d.interval)
      .filter((i): i is number => typeof i === 'number');

    expect(intervals.length).toBeGreaterThan(10);
    // An interval is a gap between neighbours, so it is never larger than the
    // gap to the class leader for the same car.
    for (const [, drivers] of result.current) {
      for (const driver of drivers.slice(1)) {
        if (driver.interval === undefined || driver.gap?.value === undefined) {
          continue;
        }
        expect(driver.interval).toBeLessThanOrEqual(driver.gap.value + 0.001);
      }
    }
  });

  it('works out position change against the qualifying grid', () => {
    const { result } = renderHook(
      () =>
        useDriverStandings(config({ positionChange: { enabled: true } }), {
          showAll: true,
        }),
      { wrapper: harness.wrapper }
    );

    const changes = flatten(result.current)
      .map((d) => d.positionChange)
      .filter((c): c is number => typeof c === 'number');

    expect(changes.length).toBeGreaterThan(10);
    // Somebody gained and somebody lost; an all-zero column would mean the
    // qualifying results never reached the calculation.
    expect(changes.some((c) => c > 0)).toBe(true);
    expect(changes.some((c) => c < 0)).toBe(true);
  });

  it('slices the field down when showAll is off', () => {
    const { result: all } = renderHook(
      () => useDriverStandings(config(), { showAll: true }),
      { wrapper: harness.wrapper }
    );
    const { result: sliced } = renderHook(
      () => useDriverStandings(config(), { showAll: false }),
      { wrapper: harness.wrapper }
    );

    expect(flatten(sliced.current).length).toBeLessThan(
      flatten(all.current).length
    );
  });

  it('keeps the player in the sliced view', () => {
    const { result } = renderHook(
      () => useDriverStandings(config(), { showAll: false }),
      { wrapper: harness.wrapper }
    );

    const player = flatten(result.current).find((d) => d.isPlayer);
    expect(player).toBeTruthy();
    expect(player?.carIdx).toBe(harness.focusCarIdx);
  });

  it('leaves the pace car out of the standings', () => {
    const paceCarIdx = Number(
      fixture.drivers.find((d) => Number(d.CarIsPaceCar) === 1)?.CarIdx ?? -1
    );
    expect(paceCarIdx).toBeGreaterThanOrEqual(0);

    const { result } = renderHook(
      () => useDriverStandings(config(), { showAll: true }),
      { wrapper: harness.wrapper }
    );

    const carIdxs = flatten(result.current).map((d) => d.carIdx);
    expect(carIdxs).not.toContain(paceCarIdx);
  });
});
