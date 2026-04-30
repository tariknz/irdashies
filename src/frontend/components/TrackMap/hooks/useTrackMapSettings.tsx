import { useDashboard } from '@irdashies/context';
import { TrackMapWidgetSettings } from '@irdashies/types';

export const useTrackMapSettings = () => {
  const { currentDashboard } = useDashboard();

  const settings = currentDashboard?.widgets.find(
    (widget) => widget.id === 'map'
  )?.config;
  return settings as unknown as TrackMapWidgetSettings['config'];
};
