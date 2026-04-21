import { useTrackId } from './hooks/useTrackId';
import { useDriverProgress } from './hooks/useDriverProgress';
import { useTrackMapSettings } from './hooks/useTrackMapSettings';
import { useHighlightColor } from './hooks/useHighlightColor';
import { TrackCanvas } from './TrackCanvas';
import { useSessionVisibility, useTelemetryValue } from '@irdashies/context';

const debug = import.meta.env.DEV || import.meta.env.MODE === 'storybook';

export const TrackMap = () => {
  const trackId = useTrackId();
  const { drivers: driversTrackData, identities } = useDriverProgress();
  const settings = useTrackMapSettings();
  const highlightColor = useHighlightColor();
  const isOnTrack = useTelemetryValue('IsOnTrack');

  if (!useSessionVisibility(settings?.sessionVisibility)) return <></>;

  // Hide if showOnlyWhenOnTrack is enabled and player is not on track
  if (settings?.showOnlyWhenOnTrack && !isOnTrack) {
    return <></>;
  }

  if (!trackId) return <></>;

  return (
    <div className="w-full h-full">
      <TrackCanvas
        trackId={trackId}
        drivers={driversTrackData}
        driverIdentities={identities}
        turnLabels={{
          enabled: settings?.turnLabels?.enabled ?? false,
          labelType: settings?.turnLabels?.labelType ?? 'both',
          highContrast: settings?.turnLabels?.highContrast ?? true,
          labelFontSize: settings?.turnLabels?.labelFontSize ?? 100,
        }}
        showCarNumbers={settings?.showCarNumbers ?? true}
        displayMode={settings?.displayMode ?? 'carNumber'}
        invertTrackColors={settings?.invertTrackColors ?? false}
        driverCircleSize={settings?.driverCircleSize ?? 40}
        playerCircleSize={settings?.playerCircleSize ?? 40}
        trackmapFontSize={settings?.trackmapFontSize ?? 100}
        trackLineWidth={settings?.trackLineWidth ?? 20}
        trackOutlineWidth={settings?.trackOutlineWidth ?? 40}
        highlightColor={
          settings?.useHighlightColor ? highlightColor : undefined
        }
        isMinimalTrack={settings?.styling?.isMinimalTrack ?? true}
        isMinimalCar={settings?.styling?.isMinimalCar ?? true}
        playerIconEnabled={settings?.playerIconEnabled ?? false}
        playerIconDataUrl={settings?.playerIconDataUrl ?? ''}
        debug={debug}
      />
    </div>
  );
};
