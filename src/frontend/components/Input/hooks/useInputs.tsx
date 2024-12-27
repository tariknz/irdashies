import { useMemo } from 'react';
import { useTelemetry } from '@irdashies/context';
import { useSingleTelemetryValue } from '../../../context/TelemetryStore/TelemetryStore';

export const useInputs2 = () => {
  const { telemetry } = useTelemetry();

  const brakeValue = telemetry?.Brake?.value?.[0] ?? 0;
  const throttleValue = telemetry?.Throttle?.value?.[0] ?? 0;
  const clutchValue = telemetry?.Clutch?.value?.[0] ?? 0;
  const gearValue = telemetry?.Gear?.value?.[0] ?? 0;
  const speedValue = telemetry?.Speed?.value?.[0] ?? 0;

  const brake = useMemo(() => brakeValue, [brakeValue]);
  const throttle = useMemo(() => throttleValue, [throttleValue]);
  const clutch = useMemo(() => clutchValue, [clutchValue]);
  const gear = useMemo(() => gearValue, [gearValue]);
  const speed = useMemo(() => speedValue, [speedValue]);

  return { brake, throttle, clutch, gear, speed };
};

export const useInputs = () => {
  const brake = useSingleTelemetryValue('Brake');
  const throttle = useSingleTelemetryValue('Throttle');
  const clutch = useSingleTelemetryValue('Clutch');
  const gear = useSingleTelemetryValue('Gear');
  const speed = useSingleTelemetryValue('Speed');

  return { brake, throttle, clutch, gear, speed };
};
