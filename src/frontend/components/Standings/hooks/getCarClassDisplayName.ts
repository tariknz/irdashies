import type { Driver } from '@irdashies/types';

const CAR_CATEGORY_BY_ID: Readonly<Record<number, string>> = {
  // GT3
  132: 'GT3',
  133: 'GT3',
  156: 'GT3',
  169: 'GT3',
  173: 'GT3',
  184: 'GT3',
  185: 'GT3',
  188: 'GT3',
  194: 'GT3',
  206: 'GT3',

  // LMP2
  128: 'LMP2',

  // GTP
  159: 'GTP',
  168: 'GTP',
  170: 'GTP',
  174: 'GTP',
  196: 'GTP',
};

const nonEmpty = (value: string | null | undefined) => value?.trim() || null;

export const getCarClassDisplayName = (
  classId: number,
  drivers: Driver[]
): string => {
  const suppliedName = drivers
    .map((driver) => nonEmpty(driver.CarClassShortName))
    .find((name): name is string => name !== null);
  if (suppliedName) return suppliedName;

  const categories = new Set(
    drivers.map((driver) => CAR_CATEGORY_BY_ID[driver.CarID])
  );
  if (categories.size === 1) {
    const category = categories.values().next().value;
    if (category) return category;
  }

  const carIds = new Set(drivers.map((driver) => driver.CarID));
  if (carIds.size === 1) {
    const modelName = drivers
      .map((driver) => nonEmpty(driver.CarScreenNameShort))
      .find((name): name is string => name !== null);
    if (modelName) return modelName;
  }

  return `Class ${classId}`;
};
