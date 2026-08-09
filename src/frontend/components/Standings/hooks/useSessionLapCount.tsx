import { useSessionTimingSnapshot } from '@irdashies/context';

const EMPTY = {
  state: 0,
  currentLap: 0,
  totalLaps: 0,
  time: 0,
  timeTotal: 0,
  timeRemaining: 0,
  greenFlagTimestamp: 0,
};

export const useSessionLapCount = () => useSessionTimingSnapshot() ?? EMPTY;
