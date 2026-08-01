import { useTelemetryValues } from '@irdashies/context';

export const useSessionBestLapTime = (): number | undefined => {
  const allBestLapTimes = useTelemetryValues('CarIdxBestLapTime');
  return allBestLapTimes && allBestLapTimes.some((t) => t > 0)
    ? Math.min(...allBestLapTimes.filter((t) => t > 0))
    : undefined;
};
