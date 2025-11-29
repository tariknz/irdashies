import { useTrackId } from './hooks/useTrackId';
import { useDriverProgress } from './hooks/useDriverProgress';
import { useTrackMapSettings } from './hooks/useTrackMapSettings';
import { TrackCanvas } from './TrackCanvas';

const debug = import.meta.env.DEV || import.meta.env.MODE === 'storybook';

export const TrackMap = () => {
  const trackId = useTrackId();
  const driversTrackData = useDriverProgress();
  const settings = useTrackMapSettings();

  if (!trackId) return <></>;

  return (
    <div className="w-full h-full">
      <TrackCanvas
        trackId={trackId}
        drivers={driversTrackData}
        enableTurnNames={settings?.enableTurnNames ?? false}
        debug={debug}
      />
    </div>
  );
};
