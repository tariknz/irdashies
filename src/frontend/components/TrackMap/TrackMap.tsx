import { useTrackId } from './hooks/useTrackId';
import { useDriverProgress } from './hooks/useDriverProgress';
import { TrackCanvas } from './TrackCanvas';

export const TrackMap = () => {
  const trackId = useTrackId();
  const driversTrackData = useDriverProgress();

  if (!trackId) return <></>;

  return <TrackCanvas trackId={trackId} drivers={driversTrackData} />;
};
