export type TemperatureCondition = 'cold' | 'optimal' | 'hot' | 'unavailable';
export type WearCondition = 'healthy' | 'worn' | 'replace' | 'unavailable';

export type TyreZoneReading = number | null | undefined;

export function tyreZoneTemperatures(
  tyreIndex: number,
  left: readonly TyreZoneReading[] | undefined,
  middle: readonly TyreZoneReading[] | undefined,
  right: readonly TyreZoneReading[] | undefined
): [TyreZoneReading, TyreZoneReading, TyreZoneReading] {
  const onLeftSide = tyreIndex % 2 === 0;
  const innerSide = onLeftSide ? right : left;
  const outerSide = onLeftSide ? left : right;
  return [innerSide?.[tyreIndex], middle?.[tyreIndex], outerSide?.[tyreIndex]];
}

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
