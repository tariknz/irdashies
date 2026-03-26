import { useDashboard } from '@irdashies/context';
import { BlindSpotMonitorWidgetSettings } from '@irdashies/types';

export const useBlindSpotMonitorSettings = () => {
  const { currentDashboard } = useDashboard();

  const settings = currentDashboard?.widgets.find(
    (widget) => widget.id === 'blindspotmonitor'
  )?.config;

  if (
    settings &&
    typeof settings === 'object' &&
    'distAhead' in settings &&
    'distBehind' in settings
  ) {
    return settings as unknown as BlindSpotMonitorWidgetSettings['config'];
  }

  return undefined;
};
