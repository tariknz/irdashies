import { useDashboard } from '@irdashies/context';
import type { PitlaneHelperWidgetSettings } from '@irdashies/types';

export const usePitlaneHelperSettings = () => {
  const { currentDashboard } = useDashboard();

  const pitlaneSettings = currentDashboard?.widgets.find(
    (widget) => widget.id === 'pitlanehelper'
  )?.config;

  return pitlaneSettings as unknown as PitlaneHelperWidgetSettings['config'];
};
