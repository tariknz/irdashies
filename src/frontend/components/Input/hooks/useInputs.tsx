import { useTelemetryValue } from '@irdashies/context';

export const useInputs = (useRawValues: boolean) => {
  const brake = useTelemetryValue(useRawValues ? 'BrakeRaw' : 'Brake');
  const throttle = useTelemetryValue(useRawValues ? 'ThrottleRaw' : 'Throttle');
  const clutchRaw = useTelemetryValue(useRawValues ? 'ClutchRaw' : 'Clutch');
  const gear = useTelemetryValue('Gear');
  const speed = useTelemetryValue('Speed');
  const unit = useTelemetryValue('DisplayUnits');
  const steer = useTelemetryValue('SteeringWheelAngle');
  const brakeAbsActive = useTelemetryValue<boolean>('BrakeABSactive');

  // 0=disengaged (pedal pressed) to 1=fully engaged (pedal not pressed) so we need to invert it
  const clutch = clutchRaw !== undefined ? 1 - clutchRaw : undefined;

  return { brake, throttle, clutch, gear, speed, unit, steer, brakeAbsActive };
};
