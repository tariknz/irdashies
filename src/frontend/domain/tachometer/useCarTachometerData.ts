import { useMemo } from 'react';
import { useSessionStore } from '@irdashies/context';
import { getGearKey, loadCarData } from '@irdashies/utils/carData';

export const useCarTachometerData = (gear = 0) => {
  const carPath = useSessionStore(({ session }) => {
    const driverInfo = session?.DriverInfo;
    return driverInfo?.Drivers?.find(
      (driver) => driver.CarIdx === driverInfo.DriverCarIdx
    )?.CarPath;
  });
  const carData = useMemo(
    () => (carPath ? loadCarData(carPath) : null),
    [carPath]
  );

  return {
    carData,
    gearRpmThresholds: carData?.ledRpm?.[0]?.[getGearKey(gear)] ?? null,
    hasCarData: carData !== null,
  };
};
