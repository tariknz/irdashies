import { useTrackId } from './hooks/useTrackId';
import { useDriverProgress } from './hooks/useDriverProgress';
import { useTrackMapSettings } from './hooks/useTrackMapSettings';
import { useHighlightColor } from './hooks/useHighlightColor';
import { TrackCanvas } from './TrackCanvas';
import { useCurrentSessionType } from '@irdashies/context';

const debug = import.meta.env.DEV || import.meta.env.MODE === 'storybook';

export const TrackMap = () => {
  const trackId = useTrackId();
  const driversTrackData = useDriverProgress();
  const settings = useTrackMapSettings();
  const highlightColor = useHighlightColor();
  const sessionType = useCurrentSessionType();

  // Show only in selected sessions
  if (sessionType === 'Race' && !settings?.sessionVisibility?.race) return <></>;
  if (sessionType === 'Lone Qualify' && !settings?.sessionVisibility?.loneQualify) return <></>;
  if (sessionType === 'Open Qualify' && !settings?.sessionVisibility?.openQualify) return <></>;
  if (sessionType === 'Practice' && !settings?.sessionVisibility?.practice) return <></>;
  if (sessionType === 'Offline Testing' && !settings?.sessionVisibility?.offlineTesting) return <></>;

  if (!trackId) return <></>;

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
