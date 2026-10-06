import { describe, expect, it } from 'vitest';
import type { Standings } from '@irdashies/domain';
import {
  buildBroadcastRows,
  diffClassPositions,
  findBattle,
  racePhase,
} from './broadcastRows';
import { SessionState } from '@irdashies/types';

const car = (
  carIdx: number,
  classPosition: number | undefined,
  isPlayer = false
) =>
  ({
    carIdx,
    classPosition,
    isPlayer,
    carClass: { id: 1, color: 0xffda59, name: 'GTP' },
  }) as Standings;

describe('buildBroadcastRows', () => {
  it('keeps the top drivers per class and adds the focus car', () => {
    const rows = buildBroadcastRows(
      [['1', [car(1, 1), car(2, 2), car(3, 3), car(4, 4, true)]]],
      2
    );
    expect(rows.map((r) => r.key)).toEqual([
      'class-1',
      'car-1',
      'car-2',
      'car-4',
    ]);
  });

  it('skips empty classes', () => {
    expect(buildBroadcastRows([['1', []]], 5)).toEqual([]);
  });
});

describe('diffClassPositions', () => {
  it('reports gains and losses', () => {
    const changes = diffClassPositions(
      [car(1, 1), car(2, 2)],
      [car(1, 2), car(2, 1)]
    );
    expect(Object.fromEntries(changes)).toEqual({ 1: -1, 2: 1 });
  });

  it('ignores new cars and missing positions', () => {
    const changes = diffClassPositions(
      [car(1, 1), car(2, undefined)],
      [car(1, 1), car(2, 3), car(3, 2)]
    );
    expect(changes.size).toBe(0);
  });
});

describe('findBattle', () => {
  const withInterval = (carIdx: number, interval?: number) =>
    ({ ...car(carIdx, carIdx), interval }) as Standings;

  it('picks the closest pair inside the shown rows', () => {
    const drivers = [
      withInterval(1),
      withInterval(2, 0.8),
      withInterval(3, 0.3),
      withInterval(4, 0.1),
    ];
    expect(findBattle(drivers, 3, 1)?.map((d) => d.carIdx)).toEqual([2, 3]);
  });

  it('returns nothing when everyone is too far apart', () => {
    expect(findBattle([withInterval(1), withInterval(2, 1.5)], 5, 1)).toBe(
      undefined
    );
  });
});

describe('racePhase', () => {
  it('shows the grid before the green flag and the podium after the flag', () => {
    expect(racePhase('Race', SessionState.Warmup)).toBe('grid');
    expect(racePhase('Race', SessionState.Racing)).toBe(undefined);
    expect(racePhase('Race', SessionState.CoolDown)).toBe('podium');
  });

  it('only applies to races', () => {
    expect(racePhase('Practice', SessionState.Checkered)).toBe(undefined);
  });
});
