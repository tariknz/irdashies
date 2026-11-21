import { getGearKey } from '@irdashies/utils/carData';
import { usePlayerCarData } from './usePlayerCarData';

export const useCarTachometerData = (gear = 0) => {
  const carData = usePlayerCarData();

  return {
    carData,
    gearRpmThresholds: carData?.ledRpm?.[0]?.[getGearKey(gear)] ?? null,
    hasCarData: carData !== null,
  };
};
