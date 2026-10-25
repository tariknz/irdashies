/**
 * What a car has left to run on, as one figure.
 *
 * LMU reports two budgets and which one matters depends on the car. A Hypercar
 * or LMDh is energy-limited: its stint ends when virtual energy runs out, and
 * its fuel figure is not the number that decides the race. A GTE or LMP2 is
 * fuel-limited and has no virtual energy at all. A column showing both would
 * be half empty whichever grid it faced, so this picks.
 *
 * Virtual energy where the car has it, fuel otherwise. Both TinyPedal and
 * LMUTraceHUB arrive at the same precedence from the same two fields, which is
 * as close to a settled convention as this sim has.
 *
 * Fuel arrives byte-quantised -- `mFuelFraction` over 255, roughly 0.4% a step
 * -- and virtual energy arrives as a fraction already, so both are normalised
 * to 0..1 here and the renderer never has to know which it got.
 */

/** A car with neither budget readable. Distinct from an empty tank. */
export const ENERGY_UNAVAILABLE = -1;

/** The divisor the sim quantises `mFuelFraction` by. */
const FUEL_FRACTION_SCALE = 255;

const asFraction = (value: number | undefined): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.min(value, 1)
    : undefined;

/** Fuel from the raw byte, or undefined when there is no usable reading. */
export const lmuFuelFraction = (
  raw: number | undefined
): number | undefined => {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) {
    return undefined;
  }
  return Math.min(raw / FUEL_FRACTION_SCALE, 1);
};

/**
 * One car's remaining budget, or the unavailable sentinel.
 *
 * Virtual energy is preferred whenever it is above zero rather than whenever it
 * is present, because a fuel-limited car reports 0 rather than nothing -- so
 * "has virtual energy" and "has some left" are the same test here. The cost is
 * that an energy car drained to exactly 0 falls back to its fuel figure; it is
 * in the pits either way, and the alternative is every GTE reading 0%.
 */
export const lmuEnergyRemaining = (
  fuelRaw: number | undefined,
  virtualEnergy: number | undefined
): number => {
  const energy = asFraction(virtualEnergy);
  if (energy !== undefined && energy > 0) return energy;
  const fuel = lmuFuelFraction(fuelRaw);
  if (fuel !== undefined && fuel > 0) return fuel;
  return ENERGY_UNAVAILABLE;
};

/**
 * The per-car channel, one entry per slot.
 *
 * Sized from whichever array is longer, so a slot present in one and not the
 * other still gets a reading rather than being dropped.
 */
export const lmuEnergyChannel = (
  fuel: ArrayLike<number> | undefined,
  virtualEnergy: ArrayLike<number> | undefined
): number[] => {
  const cars = Math.max(fuel?.length ?? 0, virtualEnergy?.length ?? 0);
  const out = new Array<number>(cars);
  for (let carIdx = 0; carIdx < cars; carIdx += 1) {
    out[carIdx] = lmuEnergyRemaining(fuel?.[carIdx], virtualEnergy?.[carIdx]);
  }
  return out;
};
