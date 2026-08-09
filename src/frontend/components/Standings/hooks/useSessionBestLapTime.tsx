import { useSessionBarSnapshot } from '@irdashies/context';

export const useSessionBestLapTime = (): number | undefined => {
  return useSessionBarSnapshot()?.sessionBestLap;
};
