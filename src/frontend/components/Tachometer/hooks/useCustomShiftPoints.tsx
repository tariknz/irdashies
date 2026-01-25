import { useTelemetryValue } from '../../../context/TelemetryStore/TelemetryStore';
import { useCarTachometerData } from './useCarTachometerData';
import type { ShiftPointSettings } from '../../Settings/types';

/**
 * Hook for custom shift point logic
 */
export const useCustomShiftPoints = (settings?: ShiftPointSettings) => {
  const { carData } = useCarTachometerData();
  const gear = useTelemetryValue('Gear') ?? 0;
  const rpm = useTelemetryValue('RPM') ?? 0;

  // Get current car's shift config (only if enabled)
  const carConfig = carData && settings?.carConfigs[carData.carId];
  const isCarConfigEnabled = carConfig?.enabled ?? false;
  
  // Get shift point for current gear (only if car config is enabled)
  const currentShiftPoint = isCarConfigEnabled 
    ? carConfig?.gearShiftPoints[gear.toString()]?.shiftRpm
    : undefined;
  
  // Check if we should show shift indicator
  const shouldShowShiftIndicator = !!(
    settings?.enabled &&
    isCarConfigEnabled &&
    currentShiftPoint &&
    rpm >= currentShiftPoint &&
    gear > 0 // Only for forward gears
  );

  return {
    shouldShowShiftIndicator,
    indicatorType: settings?.indicatorType || 'glow',
    indicatorColor: settings?.indicatorColor || '#00ff00',
    currentShiftPoint,
    carConfig,
  };
};