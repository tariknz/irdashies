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

  it('has no gaps to report without session results', () => {
    // A known limit of these fixtures rather than a bug: the extractor captures
    // telemetry frames and the roster, but not SessionInfo.ResultsPositions.
    // Gap, interval, position change and iRating all derive from those results,
    // so they stay empty here. Capturing results is what would unlock them.
    const { result } = renderHook(
      () =>
        useDriverStandings(config({ gap: { enabled: true } }), {
          showAll: true,
        }),
      { wrapper: harness.wrapper }
    );

    const withGaps = flatten(result.current).filter(
      (d) => (d.gap?.value ?? 0) > 0
    );
    expect(withGaps).toHaveLength(0);

    // The grouping and ordering above do not depend on results, which is why
    // they are worth asserting on this fixture and gaps are not.
    expect(result.current.length).toBe(3);
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
