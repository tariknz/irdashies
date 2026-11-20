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

  const carPath = driver?.CarPath;
  const carName = driver?.CarScreenName ?? driver?.CarScreenNameShort;

  const bodyStyle = resolveDamageBodyStyle(
    carPath,
    carData?.carClass,
    carName ?? carData?.carName
  );

  return { bodyStyle };
};
