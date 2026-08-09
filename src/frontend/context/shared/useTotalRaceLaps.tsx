import { useSessionTimingSnapshot } from '../ChannelStore';

export const useTotalRaceLaps = () => {
  const snapshot = useSessionTimingSnapshot();
  return {
    isFixedLapRace: snapshot?.isFixedLapRace ?? false,
    totalRaceLaps: snapshot?.totalRaceLaps ?? 0,
  };
};
