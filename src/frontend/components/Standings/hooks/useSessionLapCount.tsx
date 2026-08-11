import { useSessionTimingSnapshot } from '@irdashies/context';
import type { SessionTimingSnapshot } from '@irdashies/types';

const EMPTY = {
  state: 0,
  currentLap: 0,
  totalLaps: 0,
  time: 0,
  timeTotal: 0,
  timeRemaining: 0,
  greenFlagTimestamp: 0,
  sessionType: undefined,
  isFixedLapRace: false,
  totalRaceLaps: 0,
  totalRaceTime: 0,
  adjustedRaceTime: 0,
  sessionNum: null,
  version: 0,
} satisfies SessionTimingSnapshot;

export const useSessionLapCount = () => useSessionTimingSnapshot() ?? EMPTY;
