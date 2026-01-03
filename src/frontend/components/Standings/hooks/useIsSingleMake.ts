import { useMemo } from 'react';
import { useSessionDrivers, useWeekendInfoNumCarClasses } from '@irdashies/context';
import { CAR_ID_TO_CAR_MANUFACTURER } from '../components/CarManufacturer/carManufacturerMapping';

/**
 * Returns true when the session contains only a single car manufacturer.
 * If the session is multi-class (NumCarClasses > 1) this will always return false
 * so manufacturers remain visible in multi-class sessions.
 */
export const useIsSingleMake = () => {
  const sessionDrivers = useSessionDrivers();
  const numCarClasses = useWeekendInfoNumCarClasses();

  return useMemo(() => {
    if (!sessionDrivers?.length) return false;

    // If multi-class, always show manufacturers regardless of hideIfSingleMake
    if ((numCarClasses ?? 0) > 1) return false;

    const manufacturers = new Set<string>();
    for (const driver of sessionDrivers) {
      const manufacturer =
        CAR_ID_TO_CAR_MANUFACTURER[driver.CarID]?.manufacturer ?? 'unknown';
      manufacturers.add(manufacturer);
      if (manufacturers.size > 1) return false;
    }

    return manufacturers.size === 1;
  }, [sessionDrivers, numCarClasses]);
};