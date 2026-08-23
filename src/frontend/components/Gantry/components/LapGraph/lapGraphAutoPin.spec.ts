import { describe, expect, it } from 'vitest';
import { autoPinCarIdxs, type AutoPinDriver } from './lapGraphAutoPin';

const field = (): AutoPinDriver[] =>
  Array.from({ length: 12 }, (_, index) => ({
    carIdx: index + 1,
    classPosition: index + 1,
    isPlayer: index + 1 === 8,
  }));

describe('autoPinCarIdxs', () => {
  it('pins the leader, the player and the cars either side of the player', () => {
    // Player is 8th, so positions 5 to 11, plus the leader in position 1.
    expect(autoPinCarIdxs(field(), 1)).toEqual([1, 5, 6, 7, 8, 9, 10, 11]);
  });

  it('does not duplicate the leader when the player is leading', () => {
    const drivers = field().map((driver) => ({
      ...driver,
      isPlayer: driver.classPosition === 1,
    }));

    expect(autoPinCarIdxs(drivers, 1)).toEqual([1, 2, 3, 4]);
  });

  it('pins only the leader when there is no player in the class', () => {
    const drivers = field().map((driver) => ({ ...driver, isPlayer: false }));

    expect(autoPinCarIdxs(drivers, 3)).toEqual([3]);
  });

  it('returns nothing for an empty class with no leader', () => {
    expect(autoPinCarIdxs([], null)).toEqual([]);
  });

  it('still pins the player when their position is not known yet', () => {
    const drivers: AutoPinDriver[] = [
      { carIdx: 4, classPosition: 0, isPlayer: true },
      { carIdx: 5, classPosition: 1, isPlayer: false },
    ];

    expect(autoPinCarIdxs(drivers, 5)).toEqual([4, 5]);
  });

  it('ignores cars whose position is not known', () => {
    const drivers: AutoPinDriver[] = [
      { carIdx: 1, classPosition: 1, isPlayer: false },
      { carIdx: 2, classPosition: 2, isPlayer: true },
      { carIdx: 3, isPlayer: false },
    ];

    expect(autoPinCarIdxs(drivers, 1)).toEqual([1, 2]);
  });

  it('is stable across a reshuffle that does not change the set', () => {
    const drivers = field();
    const reversed = [...drivers].reverse();

    expect(autoPinCarIdxs(reversed, 1)).toEqual(autoPinCarIdxs(drivers, 1));
  });

  it('honours a narrower neighbour window', () => {
    expect(autoPinCarIdxs(field(), 1, 1)).toEqual([1, 7, 8, 9]);
  });
});
