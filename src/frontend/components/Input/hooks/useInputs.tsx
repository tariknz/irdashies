import { useSingleTelemetryValue } from '@irdashies/context';

export const useInputs = () => {
  const brake = useSingleTelemetryValue('Brake');
  const throttle = useSingleTelemetryValue('Throttle');
  const clutch = useSingleTelemetryValue('Clutch');
  const gear = useSingleTelemetryValue('Gear');
  const speed = useSingleTelemetryValue('Speed');

  return { brake, throttle, clutch, gear, speed };
};
