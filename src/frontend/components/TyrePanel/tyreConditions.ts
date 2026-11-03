export type TemperatureCondition = 'cold' | 'optimal' | 'hot' | 'unavailable';
export type WearCondition = 'healthy' | 'worn' | 'replace' | 'unavailable';

export const isAvailable = (
  value: number | null | undefined
): value is number => Number.isFinite(value) && (value as number) >= 0;

export function getTemperatureCondition(
  temperature: number | null | undefined,
  coldThreshold: number,
  hotThreshold: number
): TemperatureCondition {
  if (!isAvailable(temperature)) return 'unavailable';
  if (temperature < coldThreshold) return 'cold';
  if (temperature > hotThreshold) return 'hot';
  return 'optimal';
}

export function getWearCondition(
  remainingFraction: number | null | undefined,
  wornThreshold: number,
  replaceThreshold: number
): WearCondition {
  if (!isAvailable(remainingFraction)) return 'unavailable';
  const remainingPercent = remainingFraction * 100;
  if (remainingPercent <= replaceThreshold) return 'replace';
  if (remainingPercent <= wornThreshold) return 'worn';
  return 'healthy';
}
