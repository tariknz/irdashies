import { useStoreWithEqualityFn } from 'zustand/traditional';
import { shallow } from 'zustand/shallow';
import { useSessionStore } from '../SessionStore/SessionStore';
import { useFocusCarIdx } from './useFocusCarIdx';

export interface FocusedDriverFields {
  licString: string;
  iRating: number;
  carClassID: number;
}

/**
 * Returns lightweight fields of the focus car's driver with shallow equality,
 * so consumers re-render only when those specific fields change rather than
 * on every drivers-array reference change.
 */
export const useFocusedDriver = (): FocusedDriverFields | undefined => {
  const focusedCarIdx = useFocusCarIdx();
  return useStoreWithEqualityFn(
    useSessionStore,
    (state): FocusedDriverFields | undefined => {
      if (focusedCarIdx === undefined) return undefined;
      const driver = state.session?.DriverInfo?.Drivers?.find(
        (d) => d.CarIdx === focusedCarIdx
      );
      if (!driver) return undefined;
      return {
        licString: driver.LicString,
        iRating: driver.IRating,
        carClassID: driver.CarClassID,
      };
    },
    shallow
  );
};
