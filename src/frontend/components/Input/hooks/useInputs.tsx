import { useDriverControlsSnapshot } from '@irdashies/context';

export const useInputs = (useRawValues: boolean) => {
  const snapshot = useDriverControlsSnapshot();
  const brake = useRawValues ? snapshot?.brakeRaw : snapshot?.brake;
  const throttle = useRawValues ? snapshot?.throttleRaw : snapshot?.throttle;
  const clutchRaw = useRawValues ? snapshot?.clutchRaw : snapshot?.clutch;
  const gear = snapshot?.gear;
  const speed = snapshot?.speed;
  const unit = snapshot?.displayUnits;
  const steer = snapshot?.steeringWheelAngle;
  const brakeAbsActive = snapshot?.brakeAbsActive;

  // 0=disengaged (pedal pressed) to 1=fully engaged (pedal not pressed) so we need to invert it
  const clutch = clutchRaw !== undefined ? 1 - clutchRaw : undefined;

  return { brake, throttle, clutch, gear, speed, unit, steer, brakeAbsActive };
};
