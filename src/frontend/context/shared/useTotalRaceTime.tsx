import { useSessionTimingSnapshot } from '../ChannelStore';

export const useTotalRaceTime = () => {
  const snapshot = useSessionTimingSnapshot();
  return {
    isFixedLapRace: snapshot?.isFixedLapRace ?? false,
    totalRaceTime: snapshot?.totalRaceTime ?? 0,
    adjustedRaceTime: snapshot?.adjustedRaceTime ?? 0,
  };
};
