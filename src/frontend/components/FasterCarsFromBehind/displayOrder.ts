export const FASTER_CARS_DISPLAY_ITEMS = [
  'driverName',
  'badge',
  'distance',
] as const;

export type FasterCarsDisplayItem = (typeof FASTER_CARS_DISPLAY_ITEMS)[number];

const isDisplayItem = (value: unknown): value is FasterCarsDisplayItem =>
  FASTER_CARS_DISPLAY_ITEMS.some((item) => item === value);

export const normalizeFasterCarsDisplayOrder = (
  saved: unknown
): FasterCarsDisplayItem[] => {
  const kept = Array.isArray(saved)
    ? [...new Set(saved.filter(isDisplayItem))]
    : [];
  return [
    ...kept,
    ...FASTER_CARS_DISPLAY_ITEMS.filter((item) => !kept.includes(item)),
  ];
};
