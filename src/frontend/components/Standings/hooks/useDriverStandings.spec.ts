import { describe, it, expect } from 'vitest';
import { calculateLapDeltas } from './useDriverStandings';

describe('calculateLapDeltas', () => {
  it('should return undefined when disabled', () => {
    const history = [[90], [91]];
    expect(calculateLapDeltas(history, 0, false)).toBeUndefined();
  });

  it('should return undefined when focusCarIdx is undefined', () => {
    const history = [[90], [91]];
    expect(calculateLapDeltas(history, undefined, true)).toBeUndefined();
  });

  it('should return undefined when focus car has no history', () => {
    const history = [[90], []];
    expect(calculateLapDeltas(history, 1, true)).toBeUndefined();
  });

  it('should return empty array for focus car itself', () => {
    const history = [
      [90, 91],
      [89, 90],
    ];
    const result = calculateLapDeltas(history, 0, true);
    expect(result?.[0]).toEqual([]);
  });

  it('should compare matching laps when both have equal history', () => {
    // Player (idx 0) and car (idx 1) both have 3 laps
    const history = [
      [90.0, 89.8, 90.2], // player
      [90.5, 90.3, 90.7], // other car
    ];
    const result = calculateLapDeltas(history, 0, true);
    // Each of car's laps compared to matching player lap
    expect(result?.[1]).toEqual([
      90.5 - 90.0, // lap 1 vs lap 1 = +0.5
      90.3 - 89.8, // lap 2 vs lap 2 = +0.5
      90.7 - 90.2, // lap 3 vs lap 3 = +0.5
    ]);
  });

  it('should align from end when car ahead has more laps', () => {
    // Car ahead (idx 1) crossed S/F first, has 4 laps. Player has 3.
    const history = [
      [90.0, 89.8, 90.2], // player: 3 laps
      [90.5, 90.3, 90.7, 90.4], // car ahead: 4 laps
    ];
    const result = calculateLapDeltas(history, 0, true);
    // Only compare the 3 most recent of each:
    // car's [90.3, 90.7, 90.4] vs player's [90.0, 89.8, 90.2]
    expect(result?.[1]).toEqual([
      90.3 - 90.0, // +0.3
      90.7 - 89.8, // +0.9
      90.4 - 90.2, // +0.2
    ]);
  });

  it('should align from end when player has more laps', () => {
    // Player crossed S/F first, has 4 laps. Car behind has 3.
    const history = [
      [90.0, 89.8, 90.2, 89.9], // player: 4 laps
      [90.5, 90.3, 90.7], // car behind: 3 laps
    ];
    const result = calculateLapDeltas(history, 0, true);
    // Only compare the 3 most recent of each:
    // car's [90.5, 90.3, 90.7] vs player's [89.8, 90.2, 89.9]
    expect(result?.[1]).toEqual([
      90.5 - 89.8, // +0.7
      90.3 - 90.2, // +0.1
      90.7 - 89.9, // +0.8
    ]);
  });

  it('should handle pit lap without affecting other columns', () => {
    // Car pits on lap 3 (120s lap time), normal laps otherwise
    const history = [
      [90.0, 89.8, 90.2, 89.9], // player
      [90.5, 90.3, 120.0, 90.4], // car: pit on lap 3
    ];
    const result = calculateLapDeltas(history, 0, true);
    expect(result?.[1]).toEqual([
      90.5 - 90.0, // +0.5 (normal)
      90.3 - 89.8, // +0.5 (normal)
      120.0 - 90.2, // +29.8 (pit lap - only this column affected)
      90.4 - 89.9, // +0.5 (normal)
    ]);
  });

  it('should handle lapped car (different total laps)', () => {
    // Player on lap 30 (5 entries due to window), lapped car on lap 28 (5 entries)
    const history = [
      [90.0, 89.8, 90.2, 89.9, 90.1], // player's laps 26-30
      [91.5, 91.3, 91.7, 91.4, 91.6], // lapped car's laps 24-28
    ];
    const result = calculateLapDeltas(history, 0, true);
    // Both have 5 entries, compare most recent of each regardless of lap number
    expect(result?.[1]).toEqual([
      91.5 - 90.0,
      91.3 - 89.8,
      91.7 - 90.2,
      91.4 - 89.9,
      91.6 - 90.1,
    ]);
  });

  it('should handle multiple cars', () => {
    const history = [
      [90.0, 89.8], // player (idx 0)
      [89.0, 88.5], // car 1 (faster)
      [91.0, 91.5], // car 2 (slower)
      [], // car 3 (no data)
    ];
    const result = calculateLapDeltas(history, 0, true);
    expect(result?.[0]).toEqual([]); // player - empty
    expect(result?.[1]).toEqual([89.0 - 90.0, 88.5 - 89.8]); // [-1.0, -1.3]
    expect(result?.[2]).toEqual([91.0 - 90.0, 91.5 - 89.8]); // [+1.0, +1.7]
    expect(result?.[3]).toEqual([]); // no data
  });

  it('should skip focus laps with zero time', () => {
    const history = [
      [0, 90.0], // player: first lap was invalid
      [91.0, 91.5],
    ];
    const result = calculateLapDeltas(history, 0, true);
    // First focus lap is 0, should be skipped
    expect(result?.[1]).toEqual([91.5 - 90.0]);
  });
});
