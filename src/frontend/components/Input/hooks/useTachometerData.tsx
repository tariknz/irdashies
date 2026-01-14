import { useTelemetryValue } from '@irdashies/context';
import type { Telemetry } from '@irdashies/types';
import { useSessionStore } from '../../../context/SessionStore/SessionStore';
import { useCarTachometerData } from './useCarTachometerData';

/**
 * Hook for tachometer-specific telemetry data.
 * Encapsulates all RPM and shift light logic with car-specific data integration.
 */
export const useTachometerData = () => {
  const rpm = useTelemetryValue('RPM') ?? 0;
  const shiftGrindRpm = useTelemetryValue('ShiftGrindRPM') ?? 0;
  const { carData, gearRpmThresholds, hasCarData } = useCarTachometerData();

  // Get car-specific redline from session data
  const driverCarRedLine = useSessionStore(state => state.session?.DriverInfo?.DriverCarRedLine);

  // Use car-specific maximum RPM from multiple sources in order of preference
  const maxRpm =
    driverCarRedLine || // First preference: session data redline
    (shiftGrindRpm > 0 ? shiftGrindRpm : null) || // Second: telemetry shift grind RPM
    7500; // Conservative fallback for safety

  // iRacing shift lights telemetry values
  const shiftRpm = useTelemetryValue('DriverCarSLShiftRPM' as keyof Telemetry) ?? 0;  // Purple LEDs
  const blinkRpm = useTelemetryValue('DriverCarSLBlinkRPM' as keyof Telemetry) ?? 0;  // Blinking LEDs

  return {
    rpm,
    maxRpm,
    shiftRpm,
    blinkRpm,
    // Car-specific data
    carData,
    gearRpmThresholds,
    hasCarData,
  };
};
