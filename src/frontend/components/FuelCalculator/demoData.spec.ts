import { describe, expect, it } from 'vitest';
import { demoFuelData, demoFuelGraph, demoFuelHistory } from './demoData';

describe('shared Fuel demo fixture', () => {
  it('keeps summary, graph, and table consumption consistent', () => {
    const rows = demoFuelHistory(30, 7);
    const values = [...rows].reverse().map((lap) => lap.fuelUsed);
    expect(values).toEqual(demoFuelGraph.fuelValues);
    expect(rows[0].fuelUsed).toBe(demoFuelData.lastLapUsage);
    expect(rows.every((lap) => lap.sessionNum === 7)).toBe(true);
    for (const [count, average] of [
      [5, demoFuelData.avgLaps],
      [10, demoFuelData.avg10Laps],
      [30, demoFuelData.avgAllGreenLaps],
    ]) {
      const selected = rows.slice(0, count);
      expect(
        selected.reduce((sum, lap) => sum + lap.fuelUsed, 0) / selected.length
      ).toBeCloseTo(average);
    }
    expect(demoFuelGraph.avgFuel).toBeCloseTo(demoFuelData.avgAllGreenLaps);
    expect(Math.min(...values)).toBe(demoFuelData.minLapUsage);
    expect(Math.max(...values)).toBe(demoFuelData.maxLapUsage);
  });

  it('returns independent rows without changing the canonical graph fixture', () => {
    const rows = demoFuelHistory(50, 0);
    const original = rows[0].fuelUsed;
    rows[0].fuelUsed = 999;
    expect(demoFuelHistory(50, 0)[0].fuelUsed).toBe(original);
    expect(demoFuelGraph.fuelValues).not.toContain(999);
  });
});
