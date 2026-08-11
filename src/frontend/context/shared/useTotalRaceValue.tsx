import { useSessionTimingSnapshot } from '../ChannelStore';

export const useTotalRaceValue = () => {
  const snapshot = useSessionTimingSnapshot();
  return {
    isFixedLapRace: snapshot?.isFixedLapRace ?? false,
    totalRaceLaps: snapshot?.totalRaceLaps ?? 0,
    totalRaceTime: snapshot?.totalRaceTime ?? 0,
    adjustedRaceTime: snapshot?.adjustedRaceTime ?? 0,
  };
};
