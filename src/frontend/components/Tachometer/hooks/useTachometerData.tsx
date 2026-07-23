import { useTelemetryValue, useSessionStore } from '@irdashies/context';
import { useCarShiftLightData } from '@irdashies/domain/shiftLights/useCarShiftLightData';

/**
 * Hook for tachometer-specific telemetry data.
 * Encapsulates tachometer RPM and engine-temperature telemetry.
 */
export const useTachometerData = () => {
  const rpm = useTelemetryValue('RPM') ?? 0;
  const gear = useTelemetryValue('Gear') ?? 0;
  const shiftRpm = useTelemetryValue('PlayerCarSLShiftRPM') ?? 0;
  const blinkRpm = useTelemetryValue('PlayerCarSLBlinkRPM') ?? 0;
  const shiftGrindRpm = useTelemetryValue('ShiftGrindRPM') ?? 0;
  const oilTemp = useTelemetryValue('OilTemp') ?? 0;
  const waterTemp = useTelemetryValue('WaterTemp') ?? 0;
  const engineWarnings = useTelemetryValue('EngineWarnings') ?? 0;
  const { carData, gearRpmThresholds } = useCarShiftLightData();

  // Get car-specific redline from session data
  const driverCarRedLine = useSessionStore(
    (state) => state.session?.DriverInfo?.DriverCarRedLine
  );

  // Use car-specific maximum RPM from multiple sources in order of preference
  const maxRpm =
    driverCarRedLine || // First preference: session data redline
    (shiftGrindRpm > 0 ? shiftGrindRpm : null) || // Second: telemetry shift grind RPM
    7500; // Conservative fallback for safety

  return {
    rpm,
    gear,
    maxRpm,
    shiftRpm,
    blinkRpm,
    carData,
    gearRpmThresholds,
    oilTemp,
    waterTemp,
    engineWarnings,
  };
};
