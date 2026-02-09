import { useDashboard } from '@irdashies/context';
import { InputWidgetSettings } from '../../Settings/types';
import type { ShiftPointSettings } from '../../Settings/types';

/**
 * Hook for tachometer settings from dashboard config.
 * Encapsulates all tachometer configuration.
 */
export const useTachometerSettings = () => {
  const { currentDashboard } = useDashboard();

  const inputSettings = currentDashboard?.widgets.find(
    (widget) => widget.id === 'input',
  )?.config as InputWidgetSettings['config'] | undefined;

  const customShiftPoints = inputSettings?.tachometer?.customShiftPoints;

  // Convert custom shift points to ShiftPointSettings format
  const shiftPointSettings: ShiftPointSettings | undefined = customShiftPoints?.enabled ? {
    enabled: true,
    indicatorType: customShiftPoints.indicatorType,
    indicatorColor: customShiftPoints.indicatorColor,
    carConfigs: Object.fromEntries(
      Object.entries(customShiftPoints.carConfigs)
        .map(([carId, config]) => [
          carId,
          {
            carId: config.carId,
            carName: config.carName,
            gearCount: config.gearCount,
            gearShiftPoints: config.gearShiftPoints,
          },
        ])
    ),
  } : undefined;

  return {
    enabled: inputSettings?.tachometer?.enabled ?? true,
    showRpmText: inputSettings?.tachometer?.showRpmText ?? false,
    shiftPointSettings,
  };
};
