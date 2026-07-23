import { useTelemetryValue } from '@irdashies/context';
import { useCarShiftLightData } from '@irdashies/domain/shiftLights/useCarShiftLightData';

export const useShiftLightsData = () => {
  const rpm = useTelemetryValue('RPM') ?? 0;
  const gear = useTelemetryValue('Gear') ?? 0;
  const { carData, carPath } = useCarShiftLightData();

  return {
    rpm,
    gear,
    carData,
    carPath,
  };
};
