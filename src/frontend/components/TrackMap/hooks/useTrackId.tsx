import { useSessionStore } from '@irdashies/context';

export const useTrackId = () => {
  const trackId = useSessionStore(
    (state) => state.session?.WeekendInfo.TrackID
  );
  return trackId;
};
