import { useMemo } from 'react';
import { useSession, useTelemetryValue } from '@irdashies/context';

export const useDriverProgress = () => {
  const { session } = useSession();
  const carIdxLapDistPct = useTelemetryValue('CarIdxLapDistPct');

  const driverIdx = useMemo(() => {
    return session?.DriverInfo?.DriverCarIdx;
  }, [session?.DriverInfo?.DriverCarIdx]);

  const driverTrackPctValue = carIdxLapDistPct?.value[driverIdx ?? 0];
  const driverTrackPct = useMemo(
    () => driverTrackPctValue,
    [driverTrackPctValue]
  );

  return driverTrackPct ?? 0;
};
