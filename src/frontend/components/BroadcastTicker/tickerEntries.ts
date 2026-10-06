import type { Standings } from '@irdashies/domain';
import { CAR_ID_TO_CAR_MANUFACTURER } from '../shared/CarManufacturer/carManufacturerMapping';

export type TickerMode = 'overall' | 'fastest' | 'manufacturers';

export const TICKER_MODES: readonly TickerMode[] = [
  'overall',
  'fastest',
  'manufacturers',
];

const make = (carId?: number) =>
  (carId !== undefined && CAR_ID_TO_CAR_MANUFACTURER[carId]?.manufacturer) ||
  `car-${carId}`;

/**
 * Cars in overall order. The manufacturers view keeps only the best placed
 * car of each make within each class, like the TV ticker.
 */
export const tickerEntries = (
  standings: readonly Standings[],
  mode: TickerMode
): Standings[] => {
  const ordered = standings
    .filter((s) => s.position)
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  if (mode !== 'manufacturers') return ordered;
  const seen = new Set<string>();
  return ordered.filter((s) => {
    const key = `${s.carClass.id}:${make(s.carId)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};
