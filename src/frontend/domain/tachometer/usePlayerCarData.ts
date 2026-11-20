import { useMemo } from 'react';
import { useActiveSimulator, useSessionStore } from '@irdashies/context';
import type { Session } from '@irdashies/types';
import {
  loadCarData,
  loadLmuCarData,
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

  return useMemo(() => {
    if (simulator === 'lmu') return loadLmuCarData(carModel, entryName);
    return carPath ? loadCarData(carPath) : null;
  }, [simulator, carPath, carModel, entryName]);
};
