import { describe, expect, it } from 'vitest';
import { demoFuelHistory, getDemoFuelGraph } from './demoData';

describe('animated fuel history demos', () => {
  it('advances lap numbers and wobbles usage', () => {
    const a = demoFuelHistory(5, -1, 0);
    const b = demoFuelHistory(5, -1, 40);
    expect(a[0].lapNumber).toBeLessThan(b[0].lapNumber);
    expect(a.some((lap, i) => lap.fuelUsed !== b[i].fuelUsed)).toBe(true);
  });

  it('builds a graph with moving values', () => {
    const a = getDemoFuelGraph(0, 10);
    const b = getDemoFuelGraph(30, 10);
    expect(a.fuelValues).not.toEqual(b.fuelValues);
    expect(a.laps.length).toBe(10);
  });
});
