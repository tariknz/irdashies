import { useTelemetryValue } from '@irdashies/context';
import { useSessionStore } from '../../../context/SessionStore/SessionStore';

/**
 * Hook for tachometer-specific telemetry data.
 * Encapsulates all RPM and shift light logic.
 */
export const useTachometerData = () => {
  const rpm = useTelemetryValue('RPM') ?? 0;
  const shiftGrindRpm = useTelemetryValue('ShiftGrindRPM') ?? 0;

  // Get car-specific redline from session data
  const driverCarRedLine = useSessionStore(state => state.session?.DriverInfo?.DriverCarRedLine);

  // Use car-specific maximum RPM from multiple sources in order of preference
  const maxRpm =
    driverCarRedLine || // First preference: session data redline
    (shiftGrindRpm > 0 ? shiftGrindRpm : null) || // Second: telemetry shift grind RPM
    7500; // Conservative fallback for safety

  // iRacing shift lights telemetry values
  const shiftRpm = useTelemetryValue('DriverCarSLShiftRPM' as never) ?? 0;  // Purple LEDs
  const blinkRpm = useTelemetryValue('DriverCarSLBlinkRPM' as never) ?? 0;  // Blinking LEDs

  return {
    rpm,
    maxRpm,
    shiftRpm,
    blinkRpm,
  };
};
