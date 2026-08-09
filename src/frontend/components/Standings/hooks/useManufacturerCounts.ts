import { useMemo } from 'react';
import { useFocusCarIdx, useSessionDrivers } from '@irdashies/context';
import type { Driver } from '@irdashies/types';
import { CAR_ID_TO_CAR_MANUFACTURER } from '../components/CarManufacturer/carManufacturerMapping';

export interface ManufacturerCount {
  carId: number;
  count: number;
}

export interface ClassManufacturerCounts {
  counts: ManufacturerCount[];
  playerEntry?: ManufacturerCount;
}

type ManufacturerDriver = Pick<
  Driver,
  'CarIdx' | 'CarClassID' | 'CarID' | 'CarIsPaceCar' | 'IsSpectator'
>;

export const calculateManufacturerCounts = (
  drivers: ManufacturerDriver[] | undefined,
  playerCarIdx: number | undefined
): Record<string, ClassManufacturerCounts> => {
  const countsByClass = new Map<string, Map<string, ManufacturerCount>>();
  const playerManufacturerByClass = new Map<string, string>();

  for (const driver of drivers ?? []) {
    if (driver.CarIsPaceCar || driver.IsSpectator || driver.CarID == null) {
      continue;
    }

    const classId = String(driver.CarClassID);
    const manufacturer =
      CAR_ID_TO_CAR_MANUFACTURER[driver.CarID]?.manufacturer ?? 'unknown';
    let classCounts = countsByClass.get(classId);
    if (!classCounts) {
      classCounts = new Map();
      countsByClass.set(classId, classCounts);
    }

    const existing = classCounts.get(manufacturer);
    if (existing) {
      existing.count += 1;
    } else {
      classCounts.set(manufacturer, { carId: driver.CarID, count: 1 });
    }

    if (driver.CarIdx === playerCarIdx) {
      playerManufacturerByClass.set(classId, manufacturer);
    }
  }

  return Object.fromEntries(
    Array.from(countsByClass, ([classId, classCounts]) => {
      const counts = Array.from(classCounts.values()).sort(
        (a, b) => b.count - a.count
      );
      const playerManufacturer = playerManufacturerByClass.get(classId);
      const playerEntry = playerManufacturer
        ? classCounts.get(playerManufacturer)
        : undefined;

      return [classId, { counts, playerEntry }];
    })
  );
};

export const useManufacturerCounts = (enabled: boolean) => {
  const drivers = useSessionDrivers();
  const playerCarIdx = useFocusCarIdx();

  return useMemo(
    () => (enabled ? calculateManufacturerCounts(drivers, playerCarIdx) : {}),
    [drivers, enabled, playerCarIdx]
  );
};
