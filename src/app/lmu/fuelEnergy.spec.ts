import { describe, expect, it } from 'vitest';
import {
  ENERGY_UNAVAILABLE,
  lmuEnergyChannel,
  lmuEnergyRemaining,
  lmuFuelFraction,
} from './fuelEnergy';

describe('lmuFuelFraction', () => {
  it('divides the byte by 255, which is how the sim quantises it', () => {
    // Not a percentage, which an earlier note in this repo guessed at.
    expect(lmuFuelFraction(255)).toBe(1);
    expect(lmuFuelFraction(0)).toBe(0);
    expect(lmuFuelFraction(128)).toBeCloseTo(0.502, 3);
  });

  it('clamps a reading above the top of the scale', () => {
    expect(lmuFuelFraction(300)).toBe(1);
  });

  it('has no answer for a reading that cannot be fuel', () => {
    expect(lmuFuelFraction(-1)).toBeUndefined();
    expect(lmuFuelFraction(NaN)).toBeUndefined();
    expect(lmuFuelFraction(undefined)).toBeUndefined();
  });
});

describe('lmuEnergyRemaining', () => {
  it('prefers virtual energy, which is what limits an energy car', () => {
    // A Hypercar's stint ends on energy; its fuel figure is not the budget.
    expect(lmuEnergyRemaining(255, 0.42)).toBe(0.42);
  });

  it('falls back to fuel for a car with no virtual energy', () => {
    // A GTE reports 0 rather than nothing, so 0 has to mean "not an energy
    // car" here or every GTE would read empty.
    expect(lmuEnergyRemaining(255, 0)).toBe(1);
    expect(lmuEnergyRemaining(51, undefined)).toBeCloseTo(0.2, 6);
  });

  it('reports unavailable rather than empty when neither reads', () => {
    expect(lmuEnergyRemaining(0, 0)).toBe(ENERGY_UNAVAILABLE);
    expect(lmuEnergyRemaining(undefined, undefined)).toBe(ENERGY_UNAVAILABLE);
    expect(lmuEnergyRemaining(undefined, -1)).toBe(ENERGY_UNAVAILABLE);
  });

  it('clamps virtual energy to the fraction it claims to be', () => {
    expect(lmuEnergyRemaining(0, 1.5)).toBe(1);
  });
});

describe('lmuEnergyChannel', () => {
  it('reads both budgets per car and applies the precedence', () => {
    // Car 0 is energy-limited, car 1 runs on fuel, car 2 has neither.
    expect(lmuEnergyChannel([255, 51, 0], [0.42, 0, 0])).toEqual([
      0.42,
      lmuFuelFraction(51),
      ENERGY_UNAVAILABLE,
    ]);
  });

  it('covers every slot when one array is shorter', () => {
    expect(lmuEnergyChannel([255, 255], [0.5])).toEqual([0.5, 1]);
  });

  it('is empty when the sim reports nothing', () => {
    expect(lmuEnergyChannel(undefined, undefined)).toEqual([]);
  });
});
