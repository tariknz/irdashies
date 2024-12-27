import { useTelemetryValue } from '@irdashies/context';

export const useInputs = () => {
  const brake = useTelemetryValue('Brake');
  const throttle = useTelemetryValue('Throttle');
  const clutch = useTelemetryValue('Clutch');
  const gear = useTelemetryValue('Gear');
  const speed = useTelemetryValue('Speed');

  return { brake, throttle, clutch, gear, speed };
};
