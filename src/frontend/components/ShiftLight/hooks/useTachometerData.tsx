import { useDriverControlsSnapshot, useSessionStore } from '@irdashies/context';
import { useCarTachometerData } from './useCarTachometerData';

/**
 * Hook for tachometer-specific telemetry data.
 * Encapsulates all RPM and shift light logic with car-specific data integration.
 */
export const useTachometerData = () => {
  const snapshot = useDriverControlsSnapshot();
  const rpm = snapshot?.rpm ?? 0;
  const gear = snapshot?.gear ?? 1;
  const shiftGrindRpm = snapshot?.shiftGrindRpm ?? 0;
  const oilTemp = snapshot?.oilTemp ?? 0;
  const waterTemp = snapshot?.waterTemp ?? 0;
  const engineWarnings = snapshot?.engineWarnings ?? 0;
  const { carData, gearRpmThresholds, hasCarData } = useCarTachometerData(gear);

  // Get car-specific redline from session data
  const driverCarRedLine = useSessionStore(
    (state) => state.session?.DriverInfo?.DriverCarRedLine
  );
  const driverCarIdx = useSessionStore(
    (state) => state.session?.DriverInfo?.DriverCarIdx
  );
  const carPath = useSessionStore((state) => {
    const drivers = state.session?.DriverInfo?.Drivers;
    if (!drivers || driverCarIdx === undefined) return undefined;
    const driver = drivers.find((d) => d.CarIdx === driverCarIdx);
    return driver?.CarPath;
  });

  // Use car-specific maximum RPM from multiple sources in order of preference
  const maxRpm =
    driverCarRedLine || // First preference: session data redline
    (shiftGrindRpm > 0 ? shiftGrindRpm : null) || // Second: telemetry shift grind RPM
    7500; // Conservative fallback for safety

  // iRacing shift-light thresholds projected from session data
  const shiftRpm = snapshot?.shiftRpm ?? 0; // Purple LEDs
  const blinkRpm = snapshot?.blinkRpm ?? 0; // Blinking LEDs

  return {
    rpm,
    gear,
    maxRpm,
    shiftRpm,
    blinkRpm,
    oilTemp,
    waterTemp,
    engineWarnings,
    // Car-specific data
    carData,
    gearRpmThresholds,
    hasCarData,
    carPath, // CarPath for custom shift points (matches lovely-car-data)
  };
};
