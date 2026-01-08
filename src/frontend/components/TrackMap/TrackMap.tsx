import { useTrackId } from './hooks/useTrackId';
import { useDriverProgress } from './hooks/useDriverProgress';
import { useTrackMapSettings } from './hooks/useTrackMapSettings';
import { useHighlightColor } from './hooks/useHighlightColor';
import { TrackCanvas } from './TrackCanvas';
import { FlatTrackMap } from './FlatTrackMap';
import tracks from './tracks/tracks.json';
import { TrackDrawing } from './TrackCanvas';

const debug = import.meta.env.DEV || import.meta.env.MODE === 'storybook';

export const TrackMap = () => {
  const trackId = useTrackId();
  const driversTrackData = useDriverProgress();
  const settings = useTrackMapSettings();
  const highlightColor = useHighlightColor();

  const trackDrawing = trackId ? (tracks as unknown as TrackDrawing[])[trackId] : null;

  if (!trackId || !trackDrawing) return <></>;

  const mapStyle = settings?.mapStyle ?? 'shape';

  if (mapStyle === 'flat') {
    return (
      <div className="w-full h-full">
        <FlatTrackMap
          trackDrawing={trackDrawing}
          drivers={driversTrackData}
          highlightColor={settings?.useHighlightColor ? highlightColor : undefined}
          showCarNumbers={settings?.showCarNumbers ?? true}
          driverCircleSize={settings?.driverCircleSize ?? 40}
          playerCircleSize={settings?.playerCircleSize ?? 40}
        />
      </div>
    );
  }

  return (
    <div className="w-full h-full">
      <TrackCanvas
        trackId={trackId}
        drivers={driversTrackData}
        enableTurnNames={settings?.enableTurnNames ?? false}
        showCarNumbers={settings?.showCarNumbers ?? true}
        invertTrackColors={settings?.invertTrackColors ?? false}
        driverCircleSize={settings?.driverCircleSize ?? 40}
        playerCircleSize={settings?.playerCircleSize ?? 40}
        trackLineWidth={settings?.trackLineWidth ?? 20}
        trackOutlineWidth={settings?.trackOutlineWidth ?? 40}
        highlightColor={settings?.useHighlightColor ? highlightColor : undefined}
        debug={debug}
      />
    </div>
  );
};
