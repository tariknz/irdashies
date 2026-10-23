import type { Tire } from '../irsdk/types/driver-info';

/**
 * LMU's tyre compounds, in the shape the standings already read.
 *
 * Two facts have to travel together for a compound to mean anything: the
 * index, which is what per-wheel telemetry reports, and the name, which is the
 * only thing that says what an index is. iRacing carries the pairing in
 * `DriverInfo.DriverTires` and the renderer looks a wheel's index up there, so
 * that is the shape this builds.
 *
 * LMU states the pairing in two places, and this prefers the cheaper one. Each
 * car's telemetry block carries `mFrontTireCompoundIndex` beside
 * `mFrontTireCompoundName` -- index and name, from the sim, for free, for
 * every car on the grid. `/rest/garage/UIScreen/TireManagement` carries the
 * full catalogue including compounds nobody has fitted, which is more complete
 * but needs a poll, so it is the base layer the grid is merged over.
 *
 * This replaces a single entry at index 0 holding the *player's* compound
 * name. Since nothing filled the per-car indices either, every row looked the
 * value up at index 0 and found the player's tyre -- so a grid on four
 * different compounds rendered as one.
 */

/** Wheels per car, and the stride of the flat per-wheel compound array. */
export const WHEELS_PER_CAR = 4;

/** What a wheel reports when its car had no telemetry block that frame. */
export const COMPOUND_UNKNOWN = -1;

/** Just enough of a driver to read its compound pairing. */
interface CompoundSource {
  frontTireCompoundIndex?: number;
  frontTireCompoundName?: string;
  rearTireCompoundIndex?: number;
  rearTireCompoundName?: string;
}

const isUsableIndex = (index: unknown): index is number =>
  typeof index === 'number' && Number.isInteger(index) && index >= 0;

const isUsableName = (name: unknown): name is string =>
  typeof name === 'string' && name.trim().length > 0;

/**
 * The index/name pairs a grid states, merged over a catalogue.
 *
 * Later writes win, so a name the sim reports for an index overrides the
 * catalogue's name for it -- the grid is the authority on what is actually
 * fitted, and a catalogue from a stale poll should not contradict it.
 *
 * Sorted by index so the result is stable between frames: it reaches the
 * renderer through a session snapshot that is only republished when its
 * signature changes, and an unstable order would be gratuitous churn.
 */
export const lmuDriverTires = (
  drivers: readonly CompoundSource[],
  catalogue?: readonly string[]
): Tire[] => {
  const byIndex = new Map<number, string>();

  catalogue?.forEach((name, index) => {
    if (isUsableName(name)) byIndex.set(index, name.trim());
  });

  for (const driver of drivers) {
    const pairs = [
      [driver.frontTireCompoundIndex, driver.frontTireCompoundName],
      [driver.rearTireCompoundIndex, driver.rearTireCompoundName],
    ] as const;
    for (const [index, name] of pairs) {
      if (isUsableIndex(index) && isUsableName(name)) {
        byIndex.set(index, name.trim());
      }
    }
  }

  return [...byIndex.entries()]
    .sort(([a], [b]) => a - b)
    .map(([TireIndex, TireCompoundType]) => ({ TireIndex, TireCompoundType }));
};

/**
 * One car's four wheel compounds, from the flat per-car array.
 *
 * Returns the unknown sentinel four times rather than an empty array when the
 * car has no entry, so a consumer can read `[0]` without a length check and
 * gets "unknown" rather than compound 0.
 */
export const lmuWheelCompounds = (
  flat: ArrayLike<number> | undefined,
  carIdx: number
): number[] => {
  const base = carIdx * WHEELS_PER_CAR;
  if (!flat || carIdx < 0 || base + WHEELS_PER_CAR > flat.length) {
    return new Array<number>(WHEELS_PER_CAR).fill(COMPOUND_UNKNOWN);
  }
  const out = new Array<number>(WHEELS_PER_CAR);
  for (let wheel = 0; wheel < WHEELS_PER_CAR; wheel += 1) {
    const value = flat[base + wheel];
    out[wheel] = Number.isInteger(value) ? value : COMPOUND_UNKNOWN;
  }
  return out;
};

/**
 * The single compound index for a car, for consumers that carry only one.
 *
 * The front-left, which is what a one-value channel can say about a car that
 * may be on four different compounds. The per-wheel array is published
 * alongside it for anything that wants the whole picture.
 */
export const lmuCarCompound = (
  flat: ArrayLike<number> | undefined,
  carIdx: number
): number => {
  const base = carIdx * WHEELS_PER_CAR;
  if (!flat || carIdx < 0 || base >= flat.length) return COMPOUND_UNKNOWN;
  const value = flat[base];
  return Number.isInteger(value) ? value : COMPOUND_UNKNOWN;
};

/**
 * The per-car compound channel, one entry per slot.
 *
 * Sized from the flat array rather than from the grid, so a slot the sim has
 * stopped reporting falls out instead of keeping a stale compound.
 */
export const lmuCompoundChannel = (
  flat: ArrayLike<number> | undefined
): number[] => {
  if (!flat) return [];
  const cars = Math.floor(flat.length / WHEELS_PER_CAR);
  const out = new Array<number>(cars);
  for (let carIdx = 0; carIdx < cars; carIdx += 1) {
    out[carIdx] = lmuCarCompound(flat, carIdx);
  }
  return out;
};
