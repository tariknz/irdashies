import { useTrackId } from './hooks/useTrackId';
import { Track } from './Track';
import { useDriverProgress } from './hooks/useDriverProgress';

export const TrackMap = () => {
  const trackId = useTrackId();
  const driversTrackData = useDriverProgress();

  if (!trackId) return <></>;

  return <Track trackId={trackId} drivers={driversTrackData} />;
};
