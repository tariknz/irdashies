import { useMemo } from 'react';
import { useDriverCarIdx, useTelemetry } from '@irdashies/context';

export const useDriverProgress = () => {
  const driverIdx = useDriverCarIdx();
  const carIdxLapDistPct = useTelemetry('CarIdxLapDistPct');

  const driverTrackPctValue = carIdxLapDistPct?.value[driverIdx ?? 0];
  const driverTrackPct = useMemo(
    () => driverTrackPctValue,
    [driverTrackPctValue]
  );

  return driverTrackPct ?? 0;
};
