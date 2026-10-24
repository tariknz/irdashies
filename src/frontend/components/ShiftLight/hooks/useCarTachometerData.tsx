import { useEffect, useState, useMemo } from 'react';
import {
  useSessionStore,
  useDriverCarIdx,
  useActiveSimulator,
} from '@irdashies/context';
import { loadCarData, getGearKey, type CarData } from '../../../utils/carData';

/**
 * Hook for car-specific tachometer data from lovely-car-data
 */
export const useCarTachometerData = (gear = 0) => {
  const [carData, setCarData] = useState<CarData | null>(null);

  const driverCarIdx = useDriverCarIdx();
  const session = useSessionStore((state) => state.session);
  const gameId = useActiveSimulator();

  const driver = session?.DriverInfo?.Drivers?.find(
    (d) => d.CarIdx === driverCarIdx
  );
  const carPath = driver?.CarPath;
  const carCfgName = driver?.CarCfgName;
  const carScreenName = driver?.CarScreenName;
  const aliases = useMemo(() => {
    return [carCfgName, carScreenName].filter((v): v is string => !!v);
  }, [carCfgName, carScreenName]);

  useEffect(() => {
    if (!carPath) {
      setCarData(null);
      return;
    }

    setCarData(loadCarData(carPath, gameId, aliases));
  }, [carPath, gameId, aliases]);

  const gearRpmThresholds = useMemo((): number[] | null => {
    if (!carData?.ledRpm?.[0]) return null;
    return carData.ledRpm[0][getGearKey(gear)] || null;
  }, [carData, gear]);

  return {
    carData,
    gearRpmThresholds,
    hasCarData: !!carData,
  };
};
