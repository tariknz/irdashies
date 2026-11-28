import { useMemo } from 'react';
import { useSessionDrivers } from '@irdashies/context';
import { useBroadcastConfig } from './useBroadcastConfig';
import { excludedCarIdxs, sanitizeExcludedCars } from './excludedCars';

export const useBroadcastExcludedCarIdxs = (): ReadonlySet<number> => {
  const towerConfig = useBroadcastConfig('broadcast');
  const drivers = useSessionDrivers();
  const excludedKey = sanitizeExcludedCars(towerConfig?.excludedCars)
    .map((car) => car.carId)
    .join(',');

  return useMemo(
    () =>
      excludedCarIdxs(
        drivers,
        excludedKey
          ? excludedKey
              .split(',')
              .map((carId) => ({ carId: Number(carId), name: '' }))
          : []
      ),
    [drivers, excludedKey]
  );
};
