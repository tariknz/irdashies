import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import { mountFixture } from '../../../testing/renderWithFixture';
import type { ReplayFixture } from '../../../testing/replayFixture';
import roadAmerica from '../../../../test-data/fixtures/multiclass-road-america.json';
import { useDriverStandings, useCarState } from './useDriverPositions';
import { useDriverRelatives } from './useDriverRelatives';

const fixture = roadAmerica as unknown as ReplayFixture;

const paceCarIdx = (f: ReplayFixture) =>
  Number(f.drivers.find((d) => Number(d.CarIsPaceCar) === 1)?.CarIdx ?? -1);

/**
 * The Relative widget's data assembly was the least covered code in the app
 * despite being what every relative overlay renders. These exercise it against
 * a real three-class field rather than hand-built arrays.
 */
describe('relative standings over a real multiclass field', () => {
  let harness: ReturnType<typeof mountFixture>;

  beforeEach(() => {
    harness = mountFixture(fixture);
  });

  it('builds a standing for every driver on the roster', () => {
    const { result } = renderHook(() => useDriverStandings(), {
      wrapper: harness.wrapper,
    });

    expect(result.current.length).toBeGreaterThan(50);
    // The roster carries the pace car, which has no class and is filtered out
    // of the widgets rather than named.
    const racers = result.current.filter(
      (s) => s.carIdx !== paceCarIdx(fixture)
    );
    for (const standing of racers) {
      expect(standing.carIdx).toBeGreaterThanOrEqual(0);
      expect(standing.driver.name).toBeTruthy();
      expect(standing.carClass.name).toBeTruthy();
    }
  });

  it('carries all three classes through with their own identity', () => {
    const { result } = renderHook(() => useDriverStandings(), {
      wrapper: harness.wrapper,
    });

    const classes = new Map(
      result.current
        .filter((s) => s.carIdx !== paceCarIdx(fixture))
        .map((s) => [s.carClass.name, s.carClass])
    );
    expect([...classes.keys()].sort()).toEqual([
      'Dallara P217',
      'GTP',
      'IMSA23',
    ]);
    // Distinct ids and colours, which is what the widgets group and tint by.
    const ids = new Set([...classes.values()].map((c) => c.id));
    const colors = new Set([...classes.values()].map((c) => c.color));
    expect(ids.size).toBe(3);
    expect(colors.size).toBe(3);
  });

  it('marks exactly one driver as the player', () => {
    const { result } = renderHook(() => useDriverStandings(), {
      wrapper: harness.wrapper,
    });

    const players = result.current.filter((s) => s.isPlayer);
    expect(players).toHaveLength(1);
    expect(players[0].carIdx).toBe(harness.focusCarIdx);
  });

  it('reports pit road and track state per car', () => {
    const { result } = renderHook(() => useCarState(), {
      wrapper: harness.wrapper,
    });

    const onTrack = result.current.filter((c) => c.onTrack);
    expect(onTrack.length).toBeGreaterThan(40);
    // The window was chosen with cars in the pits, so this is not vacuous.
    expect(result.current.some((c) => c.onPitRoad)).toBe(true);
  });

  it('centres the relative window on the player', () => {
    const { result } = renderHook(() => useDriverRelatives({ buffer: 3 }), {
      wrapper: harness.wrapper,
    });

    expect(result.current.length).toBeGreaterThan(0);
    const playerIndex = result.current.findIndex((r) => r.isPlayer);
    expect(playerIndex).toBeGreaterThanOrEqual(0);
    expect(result.current[playerIndex].carIdx).toBe(harness.focusCarIdx);
  });

  it('orders the relative window by track position, closest ahead first', () => {
    const { result } = renderHook(() => useDriverRelatives({ buffer: 3 }), {
      wrapper: harness.wrapper,
    });

    const pcts = result.current.map((r) => r.relativePct);
    // An empty window is trivially ordered, so assert there is one first.
    expect(pcts.length).toBeGreaterThan(1);
    for (let i = 1; i < pcts.length; i++) {
      expect(pcts[i]).toBeLessThanOrEqual(pcts[i - 1]);
    }
  });

  it('never returns more than the window size', () => {
    const buffer = 3;
    const { result } = renderHook(() => useDriverRelatives({ buffer }), {
      wrapper: harness.wrapper,
    });

    // Both bounds: an empty window would satisfy the upper one on its own.
    expect(result.current.length).toBeGreaterThan(1);
    expect(result.current.length).toBeLessThanOrEqual(buffer * 2 + 1);
  });

  it('mixes classes in the relative window, as a real multiclass field does', () => {
    const { result } = renderHook(() => useDriverRelatives({ buffer: 5 }), {
      wrapper: harness.wrapper,
    });

    // Relative is proximity on track, not class, so a three class field should
    // put more than one class around the player.
    const classes = new Set(result.current.map((r) => r.carClass.name));
    expect(classes.size).toBeGreaterThan(1);
  });
});
