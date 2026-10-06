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
});
