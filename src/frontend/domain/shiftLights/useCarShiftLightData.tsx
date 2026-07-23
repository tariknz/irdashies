import { useMemo } from 'react';
import {
  useDriverCarIdx,
  useSessionStore,
  useTelemetryValue,
} from '@irdashies/context';
import { getGearKey, loadCarData } from '@irdashies/utils/carData';

export const useCarShiftLightData = () => {
  const driverCarIdx = useDriverCarIdx();
  const session = useSessionStore((state) => state.session);
  const gear = useTelemetryValue('Gear') ?? 0;
  const carPath = session?.DriverInfo?.Drivers?.find(
    (driver) => driver.CarIdx === driverCarIdx
  )?.CarPath;
  const carData = useMemo(
    () => (carPath ? loadCarData(carPath, 'iracing') : null),
    [carPath]
  );
  const gearRpmThresholds = useMemo(() => {
    if (!carData?.ledRpm?.[0]) return null;
    return carData.ledRpm[0][getGearKey(gear)] ?? null;
  }, [carData, gear]);

  return { carData, carPath, gearRpmThresholds };
};
