import { useEffect, useMemo, useSyncExternalStore } from 'react';
import { useActiveSimulator, useSessionStore } from '@irdashies/context';
import type { Session } from '@irdashies/types';
import {
  isLmuCarBundleLoaded,
  loadCarData,
  loadLmuCarBundle,
  loadLmuCarData,
  subscribeLmuCarBundle,
  type CarData,
} from '@irdashies/utils/carData';

const playerDriver = (session: Session | null) => {
  const info = session?.DriverInfo;
  return info?.Drivers?.find((driver) => driver.CarIdx === info.DriverCarIdx);
};

export const usePlayerCarData = (): CarData | null => {
  const simulator = useActiveSimulator();
  const carPath = useSessionStore(
    ({ session }) => playerDriver(session)?.CarPath
  );
  const carModel = useSessionStore(
    ({ session }) => playerDriver(session)?.CarModel
  );
  const entryName = useSessionStore(
    ({ session }) => playerDriver(session)?.CarScreenName
  );

  const isLmu = simulator === 'lmu';
  useEffect(() => {
    if (isLmu) void loadLmuCarBundle();
  }, [isLmu]);
  const lmuLoaded = useSyncExternalStore(
    subscribeLmuCarBundle,
    isLmuCarBundleLoaded
  );

  return useMemo(() => {
    if (isLmu) return lmuLoaded ? loadLmuCarData(carModel, entryName) : null;
    return carPath ? loadCarData(carPath) : null;
  }, [isLmu, lmuLoaded, carPath, carModel, entryName]);
};
