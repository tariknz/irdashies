import { useMemo } from 'react';
import { loadCarData, type CarData } from '@irdashies/utils/carData';
import type { ShiftPointSettings } from '@irdashies/types';

/**
 * Shared lookup and trigger logic for the standalone shift cue.
 *
 * `carModel` is the key as-is where the sim sets one (LMU). It must not go
 * through the iRacing car data: "Ferrari 499P" normalises to iRacing's
 * `ferrari499p`, which would look up a different car's shift points from the
 * ones saved for this one.
 */
export const useCustomShiftPoints = (
  settings: ShiftPointSettings | undefined,
  carPath: string | undefined,
  gear: number,
  rpm: number,
  carData?: CarData | null,
  carModel?: string
) => {
  const carId = useMemo(
    () =>
      carModel ||
      carData?.carId ||
      (carPath ? (loadCarData(carPath)?.carId ?? carPath) : undefined),
    [carModel, carData?.carId, carPath]
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
