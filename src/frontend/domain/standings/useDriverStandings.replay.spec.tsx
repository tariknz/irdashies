import { describe, it, expect, beforeEach, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { StandingsWidgetSettings } from '@irdashies/types';
import { getWidgetDefaultConfig } from '@irdashies/types';
import { mountFixture } from '../../../testing/renderWithFixture';
import type { ReplayFixture } from '../../../testing/replayFixture';
import roadAmerica from '../../../../test-data/fixtures/multiclass-road-america.json';
import { useDriverStandings } from './useDriverStandings';
import { useDriverLivePositions } from './useDriverLivePositions';

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

  it('uses live class positions when a caller asks for them', () => {
    // Broadcast asks for live positions whatever the Standings widget is set
    // to, so mid-lap overtakes show at once.
    const { result } = renderHook(
      () => ({
        standings: useDriverStandings(config({ useLivePosition: false }), {
          showAll: true,
          livePositions: true,
        }),
        live: useDriverLivePositions({ enabled: true }),
      }),
      { wrapper: harness.wrapper }
    );

    const drivers = flatten(result.current.standings).filter(
      (d) => result.current.live[d.carIdx] > 0
    );
    expect(drivers.length).toBeGreaterThan(0);
    for (const d of drivers) {
      expect(d.classPosition).toBe(result.current.live[d.carIdx]);
    }
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
            gap: { enabled: false },
            interval: { enabled: true, displayMode: 'laps' },
          }),
          { showAll: true }
        ),
      { wrapper: harness.wrapper }
    );

    const intervals = flatten(result.current)
      .map((d) => d.interval)
      .filter((i): i is number => typeof i === 'number');

    expect(intervals.length).toBeGreaterThan(10);
    const lapIntervals = flatten(result.current)
      .map((d) => d.interval)
      .filter((i) => typeof i === 'object');
    expect(lapIntervals.length).toBeGreaterThan(0);
    for (const interval of lapIntervals) {
      expect(interval?.laps).toBeLessThanOrEqual(-1);
      expect(Number.isInteger(interval?.laps)).toBe(true);
    }
    // An interval is a gap between neighbours, so it is never larger than the
    // gap to the class leader for the same car.
    for (const [, drivers] of result.current) {
      for (const driver of drivers.slice(1)) {
        if (
          typeof driver.interval !== 'number' ||
          driver.gap?.value === undefined
        ) {
          continue;
        }
        expect(driver.interval).toBeLessThanOrEqual(driver.gap.value + 0.001);
      }
    }
  });

  it('switches interval display modes without changing the gap', () => {
    const initialProps: { displayMode?: 'time' | 'laps' } = {};
    const { result, rerender } = renderHook(
      ({ displayMode }: { displayMode?: 'time' | 'laps' }) =>
        useDriverStandings(
          config({
            gap: { enabled: true },
            interval: { enabled: true, displayMode },
          }),
          { showAll: true }
        ),
      { wrapper: harness.wrapper, initialProps }
    );
    const legacy = flatten(result.current);
    expect(legacy.every((driver) => typeof driver.interval !== 'object')).toBe(
      true
    );

    rerender({ displayMode: 'laps' });
    const lapped = flatten(result.current);
    expect(lapped.some((driver) => typeof driver.interval === 'object')).toBe(
      true
    );
    expect(lapped.map((driver) => driver.gap)).toEqual(
      legacy.map((driver) => driver.gap)
    );

    rerender({ displayMode: 'time' });
    expect(flatten(result.current).map((driver) => driver.interval)).toEqual(
      legacy.map((driver) => driver.interval)
    );
  });

  it('changes only displayed gaps when switching to player reference', () => {
    const { result } = renderHook(
      () => ({
        leader: useDriverStandings(
          config({ gap: { enabled: true }, interval: { enabled: true } }),
          { showAll: true }
        ),
        player: useDriverStandings(
          config({
            gap: { enabled: true, reference: 'player' },
            interval: { enabled: true },
          }),
          { showAll: true }
        ),
      }),
      { wrapper: harness.wrapper }
    );
    const leader = flatten(result.current.leader);
    const player = flatten(result.current.player);
    expect(player.map((driver) => ({ ...driver, gap: undefined }))).toEqual(
      leader.map((driver) => ({ ...driver, gap: undefined }))
    );
    expect(player.find((d) => d.isPlayer)?.gap).toEqual({ value: 0, laps: 0 });
    expect(player.some((d) => (d.gap?.value ?? 0) < 0)).toBe(true);
    expect(player.some((d) => (d.gap?.value ?? 0) > 0)).toBe(true);
  });

  it('records player gap work through the existing performance bridge', () => {
    const previous = window.rendererPerfBridge;
    const recordMeasure = vi.fn();
    window.rendererPerfBridge = { recordMeasure };
    try {
      renderHook(
        () =>
          useDriverStandings(
            config({ gap: { enabled: true, reference: 'player' } }),
            { showAll: true }
          ),
        { wrapper: harness.wrapper }
      );
      expect(recordMeasure).toHaveBeenCalledWith(
        'standingsPlayerGaps',
        expect.any(Number)
      );
    } finally {
      window.rendererPerfBridge = previous;
    }
  });

  it('uses the spectator camera car as the zero reference', () => {
    const cameraCarIdx = 5;
    const spectating = mountFixture({
      ...fixture,
      frames: fixture.frames.map((frame) => ({
        ...frame,
        CamCarIdx: cameraCarIdx,
      })),
    });
    expect(cameraCarIdx).not.toBe(harness.focusCarIdx);
    const { result } = renderHook(
      () =>
        useDriverStandings(
          config({ gap: { enabled: true, reference: 'player' } }),
          { showAll: true }
        ),
      { wrapper: spectating.wrapper }
    );
    const focused = flatten(result.current).find((driver) => driver.isPlayer);
    expect(focused?.carIdx).toBe(cameraCarIdx);
    expect(focused?.gap).toEqual({ value: 0, laps: 0 });
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
