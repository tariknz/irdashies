import { useDriverProgress } from './hooks/useDriverProgress';
import { useFlatTrackMapSettings } from './hooks/useFlatTrackMapSettings';
import { useHighlightColor } from './hooks/useHighlightColor';
import { useTrackId } from './hooks/useTrackId';
import { FlatTrackMapCanvas } from './FlatTrackMapCanvas';
import tracks from './tracks/tracks.json';
import { TrackDrawing } from './TrackCanvas';
import { useSessionVisibility, useTelemetryValue } from '@irdashies/context';
import { useDriverLivePositions } from '../Standings/hooks/useDriverLivePositions';

const debug = import.meta.env.DEV || import.meta.env.MODE === 'storybook';

export const FlatTrackMap = () => {
  const trackId = useTrackId();
  const driversTrackData = useDriverProgress();
  const settings = useFlatTrackMapSettings();
  const highlightColor = useHighlightColor();
  const isOnTrack = useTelemetryValue('IsOnTrack');
  const driverLivePositions = useDriverLivePositions();

  if (!useSessionVisibility(settings?.sessionVisibility)) return <></>;

  // Hide if showOnlyWhenOnTrack is enabled and player is not on track
  if (settings?.showOnlyWhenOnTrack && !isOnTrack) {
    return <></>;
  }

  const trackDrawing = trackId ? (tracks as unknown as TrackDrawing[])[trackId] : null;

  if (!trackId || !trackDrawing) {
    return debug ? (
      <div className="w-full h-full flex items-center justify-center text-white">
        <p>No track data available</p>
      </div>
    ) : <></>;
  }

  return (
    <div className="w-full h-full">
      <FlatTrackMapCanvas
        trackDrawing={trackDrawing}
        drivers={driversTrackData}
        highlightColor={settings?.useHighlightColor ? highlightColor : undefined}
        showCarNumbers={settings?.showCarNumbers ?? true}
        displayMode={settings?.displayMode ?? 'carNumber'}
        driverCircleSize={settings?.driverCircleSize ?? 40}
        playerCircleSize={settings?.playerCircleSize ?? 40}
        trackmapFontSize={settings?.trackmapFontSize ?? 100}
        trackLineWidth={settings?.trackLineWidth ?? 20}
        trackOutlineWidth={settings?.trackOutlineWidth ?? 40}
        invertTrackColors={settings?.invertTrackColors ?? false}
        driverLivePositions={driverLivePositions}
      />
    </div>
  );
};
