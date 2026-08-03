import { useMemo } from 'react';
import {
  useSessionDrivers,
  useWeekendInfoNumCarClasses,
} from '@irdashies/context';
import { CAR_ID_TO_CAR_MANUFACTURER } from '../components/CarManufacturer/carManufacturerMapping';

/**
 * Returns true when the session contains only a single car manufacturer.
 * If the session is multi-class (NumCarClasses > 1) this will always return false
 * so manufacturers remain visible in multi-class sessions.
 *
 * `enabled` skips the per-driver manufacturer scan entirely when the caller
 * doesn't need the result (e.g. hideIfSingleMake is off) — the underlying
 * telemetry/session subscriptions stay live either way, so flipping `enabled`
 * back on recomputes correctly from current data on the next render.
 */
export const useIsSingleMake = (enabled: boolean) => {
  const sessionDrivers = useSessionDrivers();
  const numCarClasses = useWeekendInfoNumCarClasses();

  return useMemo(() => {
    if (!enabled) return false;

    if (!sessionDrivers?.length) return false;

    // Multi-class = never single make
    if ((numCarClasses ?? 0) > 1) return false;

    const manufacturers = new Set<string>();

    for (const driver of sessionDrivers) {
      // Skip non-competitors
      if (driver.CarIsPaceCar || driver.IsSpectator || driver.CarID == null) {
        continue;
      }

      const manufacturer =
        CAR_ID_TO_CAR_MANUFACTURER[driver.CarID]?.manufacturer;

      //Skip unknown mappings
      if (!manufacturer) continue;

      manufacturers.add(manufacturer);

      // More than one real manufacturer = not single-make
      if (manufacturers.size > 1) return false;
    }

    return manufacturers.size === 1;
  }, [enabled, sessionDrivers, numCarClasses]);
};
