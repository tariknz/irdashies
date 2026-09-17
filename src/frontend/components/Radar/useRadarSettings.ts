import { useDashboard } from '@irdashies/context';
import type { RadarWidgetSettings } from '@irdashies/types';

export const useRadarSettings = () => {
  const { currentDashboard } = useDashboard();
  return currentDashboard?.widgets.find((widget) => widget.id === 'radar')
    ?.config as RadarWidgetSettings['config'] | undefined;
};
