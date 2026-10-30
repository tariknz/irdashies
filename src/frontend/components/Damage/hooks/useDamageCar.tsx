import {
  useActiveSimulator,
  useDriverCarIdx,
  useSessionStore,
} from '@irdashies/context';
import { loadCarData } from '@irdashies/utils/carData';
import {
  resolveDamageBodyStyle,
  type DamageBodyStyle,
} from '../bodyStyle';

export interface DamageCarInfo {
  bodyStyle: DamageBodyStyle;
  label: string;
}

export const useDamageCar = (): DamageCarInfo => {
  const driverCarIdx = useDriverCarIdx();
  const simulator = useActiveSimulator();
  const driver = useSessionStore((state) =>
    state.session?.DriverInfo?.Drivers?.find((d) => d.CarIdx === driverCarIdx)
  );

  const carPath = driver?.CarPath;
  const carName = driver?.CarScreenName ?? driver?.CarScreenNameShort;
  const carData = carPath
    ? loadCarData(carPath, simulator ?? undefined, [
        driver?.CarCfgName,
        driver?.CarScreenName,
      ])
    : null;

  const bodyStyle = resolveDamageBodyStyle(
    carPath,
    carData?.carClass,
    carName ?? carData?.carName
  );

  const label =
    carData?.carName ??
    driver?.CarScreenNameShort ??
    driver?.CarScreenName ??
    carPath ??
    '';

  return { bodyStyle, label };
};
