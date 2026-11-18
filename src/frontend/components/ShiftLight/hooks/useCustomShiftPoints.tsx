import { useMemo } from 'react';
import { useActiveSimulator } from '@irdashies/context';
import { loadCarData, type CarData } from '@irdashies/utils/carData';
import type { ShiftPointSettings } from '@irdashies/types';

/**
 * Shared lookup and trigger logic for the standalone shift cue.
 *
 * `carModel` is the key as-is where the sim sets one (LMU) and the bundled
 * car data has no match. Prefer carData / loadCarData for the active sim.
 */
export const useCustomShiftPoints = (
  settings: ShiftPointSettings | undefined,
  carPath: string | undefined,
  gear: number,
  rpm: number,
  carData?: CarData | null,
  carModel?: string
) => {
  const gameId = useActiveSimulator();
  const carId = useMemo(
    () =>
      carData?.carId ||
      (carPath
        ? (loadCarData(carPath, gameId)?.carId ?? carModel ?? carPath)
        : carModel),
    [carData?.carId, carPath, gameId, carModel]
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
