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
  // Pedal positions, not the sim's processed values: an automatic blip on a
  // downshift moves the processed throttle without the driver touching it.
  const throttle = snapshot?.throttleRaw ?? snapshot?.throttle ?? 0;
  const brake = snapshot?.brakeRaw ?? snapshot?.brake ?? 0;
  const { carData, gearRpmThresholds, hasCarData } = useCarTachometerData(gear);

  // Get car-specific redline from session data
  const driverCarRedLine = useSessionStore(
    (state) => state.session?.DriverInfo?.DriverCarRedLine
  );
  const gearCount = useSessionStore(
    (state) => state.session?.DriverInfo?.DriverCarGearNumForward ?? 0
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
  // The key custom shift points are saved under where the sim sets it. LMU's
  // CarPath names the livery rather than the car, so the model stands in.
  const carModel = useSessionStore((state) => {
    const drivers = state.session?.DriverInfo?.Drivers;
    if (!drivers || driverCarIdx === undefined) return undefined;
    return drivers.find((d) => d.CarIdx === driverCarIdx)?.CarModel;
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
    gearCount,
    throttle,
    brake,
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
    carModel,
  };
};
