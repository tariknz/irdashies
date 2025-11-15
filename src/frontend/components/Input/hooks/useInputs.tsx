import { useTelemetryValue } from '@irdashies/context';

export const useInputs = () => {
 
  const brake = useTelemetryValue('Brake');
  const throttle = useTelemetryValue('Throttle');
  const clutch = useTelemetryValue('Clutch');
  const gear = useTelemetryValue('Gear');
  const speed = useTelemetryValue('Speed');
  const unit = useTelemetryValue('DisplayUnits');
  const steer = useTelemetryValue('SteeringWheelAngle');
  const brakeAbsActive = useTelemetryValue<boolean>('BrakeABSactive');

  const result = { brake, throttle, clutch, gear, speed, unit, steer, brakeAbsActive };
    
  return result;
};
