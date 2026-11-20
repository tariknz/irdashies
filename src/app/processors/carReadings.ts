import type { Telemetry } from '@irdashies/types';

type Frame = Record<string, { value?: readonly unknown[] } | undefined>;

const CORNERS = ['LF', 'RF', 'LR', 'RR'] as const;

export type CornerKeys = readonly (readonly string[])[];

export const cornerKeys = (...suffixes: string[]): CornerKeys =>
  CORNERS.map((corner) => suffixes.map((suffix) => `${corner}${suffix}`));

export const emptyCorners = (): (number | null)[] => [null, null, null, null];

export const valuesOf = (frame: Telemetry, key: string) =>
  (frame as unknown as Frame)[key]?.value;

export const numberOf = (frame: Telemetry, key: string): number | undefined => {
  const value = valuesOf(frame, key)?.[0];
  return typeof value === 'number' && Number.isFinite(value)
    ? value
    : undefined;
};

export const flagOf = (frame: Telemetry, key: string): boolean | undefined => {
  const value = valuesOf(frame, key)?.[0];
  return typeof value === 'boolean' ? value : undefined;
};

const meanOf = (frame: Telemetry, keys: readonly string[]): number | null => {
  let sum = 0;
  let count = 0;
  for (const key of keys) {
    const value = numberOf(frame, key);
    if (value === undefined) continue;
    sum += value;
    count += 1;
  }
  return count > 0 ? sum / count : null;
};

export const assignField = <
  Snapshot extends { version: number },
  Key extends Exclude<keyof Snapshot, 'version'>,
>(
  snapshot: Snapshot,
  key: Key,
  value: Snapshot[Key]
): boolean => {
  if (snapshot[key] === value) return false;
  snapshot[key] = value;
  return true;
};

export const syncCorners = (
  frame: Telemetry,
  values: (number | null)[],
  keys: CornerKeys
): { changed: boolean; present: boolean } => {
  let changed = false;
  let present = false;
  for (let index = 0; index < values.length; index += 1) {
    const value = meanOf(frame, keys[index]);
    if (value !== null) present = true;
    if (!Object.is(values[index], value)) {
      values[index] = value;
      changed = true;
    }
  }
  return { changed, present };
};

export const syncList = (
  target: unknown[],
  source: readonly unknown[]
): boolean => {
  let changed = target.length !== source.length;
  target.length = source.length;
  for (let index = 0; index < source.length; index += 1) {
    if (!Object.is(target[index], source[index])) {
      target[index] = source[index];
      changed = true;
    }
  }
  return changed;
};
