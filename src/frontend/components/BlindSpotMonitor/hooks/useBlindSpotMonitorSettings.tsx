import { useDashboard } from '@irdashies/context';
import { BlindSpotMonitorWidgetSettings } from '../../Settings/types';

export const useBlindSpotMonitorSettings = () => {
  const { currentDashboard } = useDashboard();

  const settings = currentDashboard?.widgets.find(
    (widget) => widget.id === 'blindspotmonitor',
  )?.config;

  if (
    settings &&
    typeof settings === 'object' &&
    'lineColor' in settings &&
    'lineOpacity' in settings &&
    'lineWidth' in settings &&
    'distAhead' in settings &&
    'distBehind' in settings
  ) {
    return settings as BlindSpotMonitorWidgetSettings['config'];
  }

  return undefined;
};

