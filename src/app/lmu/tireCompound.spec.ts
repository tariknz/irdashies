import { describe, expect, it } from 'vitest';
import {
  COMPOUND_UNKNOWN,
  lmuCarCompound,
  lmuCompoundChannel,
  lmuDriverTires,
  lmuWheelCompounds,
} from './tireCompound';

describe('lmuDriverTires', () => {
  it('pairs each index with the name the sim reports for it', () => {
    expect(
      lmuDriverTires([
        {
          frontTireCompoundIndex: 1,
          frontTireCompoundName: 'Medium',
          rearTireCompoundIndex: 0,
          rearTireCompoundName: 'Hard',
        },
      ])
    ).toEqual([
      { TireIndex: 0, TireCompoundType: 'Hard' },
      { TireIndex: 1, TireCompoundType: 'Medium' },
    ]);
  });

  it('collects compounds across the whole grid, not just one car', () => {
    // The bug this replaces: one entry at index 0 holding the player's
    // compound, so every row looked up index 0 and found the player's tyre.
    const tires = lmuDriverTires([
      { frontTireCompoundIndex: 0, frontTireCompoundName: 'Hard' },
      { frontTireCompoundIndex: 3, frontTireCompoundName: 'Wet' },
    ]);
    expect(tires).toEqual([
      { TireIndex: 0, TireCompoundType: 'Hard' },
      { TireIndex: 3, TireCompoundType: 'Wet' },
    ]);
  });

  it('keeps the catalogue order, so position stays the index', () => {
    expect(lmuDriverTires([], ['Hard', 'Medium', 'Soft', 'Wet'])).toEqual([
      { TireIndex: 0, TireCompoundType: 'Hard' },
      { TireIndex: 1, TireCompoundType: 'Medium' },
      { TireIndex: 2, TireCompoundType: 'Soft' },
      { TireIndex: 3, TireCompoundType: 'Wet' },
    ]);
  });

  it('keeps a catalogue hole as a hole rather than renumbering', () => {
    // Dropping the empty entry would move Soft from index 2 to index 1 and
    // mislabel every car on it.
    const tires = lmuDriverTires([], ['Hard', '', 'Soft']);
    expect(tires).toEqual([
      { TireIndex: 0, TireCompoundType: 'Hard' },
      { TireIndex: 2, TireCompoundType: 'Soft' },
    ]);
  });

  it('lets the grid override the catalogue for the same index', () => {
    // The grid is what is actually fitted; a catalogue from an earlier poll
    // should not contradict it.
    expect(
      lmuDriverTires(
        [{ frontTireCompoundIndex: 1, frontTireCompoundName: 'Soft Slick' }],
        ['Hard', 'Medium']
      )
    ).toEqual([
      { TireIndex: 0, TireCompoundType: 'Hard' },
      { TireIndex: 1, TireCompoundType: 'Soft Slick' },
    ]);
  });

  it('is sorted by index, whatever order the grid is in', () => {
    const tires = lmuDriverTires([
      { frontTireCompoundIndex: 3, frontTireCompoundName: 'Wet' },
      { frontTireCompoundIndex: 1, frontTireCompoundName: 'Medium' },
    ]);
    expect(tires.map((tire) => tire.TireIndex)).toEqual([1, 3]);
  });

  it('ignores a pairing missing either half', () => {
    expect(
      lmuDriverTires([
        { frontTireCompoundIndex: 1 },
        { frontTireCompoundName: 'Medium' },
        { frontTireCompoundIndex: -1, frontTireCompoundName: 'Hard' },
        { frontTireCompoundIndex: 2, frontTireCompoundName: '   ' },
      ])
    ).toEqual([]);
  });

  it('trims the sim’s fixed-width strings', () => {
    expect(
      lmuDriverTires([
        { frontTireCompoundIndex: 0, frontTireCompoundName: '  Hard  ' },
      ])
    ).toEqual([{ TireIndex: 0, TireCompoundType: 'Hard' }]);
  });

  it('has nothing to say about an empty grid and no catalogue', () => {
    expect(lmuDriverTires([])).toEqual([]);
  });
});

describe('lmuWheelCompounds', () => {
  const flat = [1, 1, 1, 1, 3, 3, 0, 0];

  it('reads one car out of the flat array', () => {
    expect(lmuWheelCompounds(flat, 0)).toEqual([1, 1, 1, 1]);
    expect(lmuWheelCompounds(flat, 1)).toEqual([3, 3, 0, 0]);
  });

  it('reports unknown for a car past the end rather than throwing', () => {
    expect(lmuWheelCompounds(flat, 5)).toEqual([-1, -1, -1, -1]);
    expect(lmuWheelCompounds(undefined, 0)).toEqual([-1, -1, -1, -1]);
    expect(lmuWheelCompounds(flat, -1)).toEqual([-1, -1, -1, -1]);
  });

  it('refuses a partial car, which would read another car’s wheels', () => {
    expect(lmuWheelCompounds([1, 1], 0)).toEqual([-1, -1, -1, -1]);
  });
});

describe('lmuCarCompound', () => {
  it('takes the front-left, which is the one value iRacing has room for', () => {
    expect(lmuCarCompound([2, 2, 2, 2, 3, 3, 0, 0], 1)).toBe(3);
  });

  it('is unknown rather than zero for a car with no entry', () => {
    // 0 is a real compound, so it cannot double as "no reading".
    expect(lmuCarCompound([], 0)).toBe(COMPOUND_UNKNOWN);
    expect(lmuCarCompound(undefined, 0)).toBe(COMPOUND_UNKNOWN);
  });
});

describe('lmuCompoundChannel', () => {
  it('gives one value per car, from the four-per-car array', () => {
    expect(lmuCompoundChannel([1, 1, 1, 1, 3, 3, 0, 0])).toEqual([1, 3]);
  });

  it('is empty when the sim reports nothing', () => {
    expect(lmuCompoundChannel(undefined)).toEqual([]);
    expect(lmuCompoundChannel([])).toEqual([]);
  });

  it('drops a trailing partial car rather than inventing one', () => {
    expect(lmuCompoundChannel([1, 1, 1, 1, 2, 2])).toEqual([1]);
  });
});
