import { useMemo } from 'react';
import { loadCarData, type CarData } from '@irdashies/utils/carData';
import type { ShiftPointSettings } from '@irdashies/types';

/** Shared lookup and trigger logic for the standalone shift cue. */
export const useCustomShiftPoints = (
  settings: ShiftPointSettings | undefined,
  carPath: string | undefined,
  gear: number,
  rpm: number,
  carData?: CarData | null
) => {
  const carId = useMemo(
    () =>
      carData?.carId ??
      (carPath ? (loadCarData(carPath)?.carId ?? carPath) : undefined),
    [carData?.carId, carPath]
  );
  const carConfig = carId ? settings?.carConfigs[carId] : undefined;
  const currentShiftPoint = carConfig?.enabled
    ? carConfig.gearShiftPoints[gear.toString()]?.shiftRpm
    : undefined;
  return {
    shouldShowShiftIndicator: !!(
      settings?.enabled &&
      carConfig?.enabled &&
      currentShiftPoint &&
      rpm >= currentShiftPoint &&
      gear > 0
    ),
    indicatorType: settings?.indicatorType ?? 'glow',
    indicatorColor: settings?.indicatorColor ?? '#00ff00',
    currentShiftPoint,
    carConfig,
  };
};
