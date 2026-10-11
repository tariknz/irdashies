import { describe, expect, it } from 'vitest';
import type { Standings } from '@irdashies/domain';
import { tickerEntries } from './tickerEntries';

// carId 56 is a Toyota, 57 a Dallara in the manufacturer mapping
const car = (carIdx: number, position: number, carId: number, classId = 1) =>
  ({ carIdx, position, carId, carClass: { id: classId } }) as Standings;

describe('tickerEntries', () => {
  it('orders cars overall and drops unplaced ones', () => {
    const list = [car(1, 2, 56), car(2, 1, 56), car(3, 0, 56)];
    expect(tickerEntries(list, 'overall').map((s) => s.carIdx)).toEqual([2, 1]);
  });

  it('keeps the best car per make and class', () => {
    const list = [
      car(1, 1, 56),
      car(2, 2, 56),
      car(3, 3, 56, 2),
      car(4, 4, 57),
    ];
    expect(tickerEntries(list, 'manufacturers').map((s) => s.carIdx)).toEqual([
      1, 3, 4,
    ]);
  });

  it('orders the fastest view by lap time and drops cars without one', () => {
    const list = [
      { ...car(1, 1, 56), fastestTime: 92.1 },
      { ...car(2, 2, 56), fastestTime: 91.4 },
      { ...car(3, 3, 56), fastestTime: 0 },
    ];
    expect(tickerEntries(list, 'fastest').map((s) => s.carIdx)).toEqual([2, 1]);
  });
});
