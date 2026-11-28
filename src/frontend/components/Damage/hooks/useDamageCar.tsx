import { useDriverCarIdx, useSessionStore } from '@irdashies/context';
import { usePlayerCarData } from '@irdashies/domain/tachometer/usePlayerCarData';
import { resolveDamageBodyStyle, type DamageBodyStyle } from '../bodyStyle';

export interface DamageCarInfo {
  bodyStyle: DamageBodyStyle;
}

export const useDamageCar = (): DamageCarInfo => {
  const driverCarIdx = useDriverCarIdx();
  const driver = useSessionStore((state) =>
    state.session?.DriverInfo?.Drivers?.find((d) => d.CarIdx === driverCarIdx)
  );
  const carData = usePlayerCarData();

  const model = driver?.CarModel?.trim();
  const bodyStyle = model
    ? resolveDamageBodyStyle(undefined, carData?.carClass, model)
    : resolveDamageBodyStyle(
        driver?.CarPath,
        carData?.carClass,
        driver?.CarScreenName ?? driver?.CarScreenNameShort ?? carData?.carName
      );

  return { bodyStyle };
};
