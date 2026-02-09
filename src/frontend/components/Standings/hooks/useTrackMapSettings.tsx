import { useDashboard } from '@irdashies/context';
import { TrackMapWidgetSettings } from '../../Settings/types';

export const useTrackMapSettings = () => {
  const { currentDashboard } = useDashboard();

  const standingsSettings = currentDashboard?.widgets.find(
    (widget) => widget.id === 'standings',
  )?.config;
  
  return standingsSettings as TrackMapWidgetSettings['config'];
}; 