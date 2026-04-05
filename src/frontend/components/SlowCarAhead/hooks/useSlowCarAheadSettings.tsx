import { useDashboard } from '@irdashies/context';
import type { SlowCarAheadWidgetSettings } from '@irdashies/types';

export const useSlowCarAheadSettings = () => {
  const { currentDashboard } = useDashboard();

  const settings = currentDashboard?.widgets.find(
    (widget) => widget.id === 'slowcarahead'
  )?.config;

  return settings as unknown as SlowCarAheadWidgetSettings['config'];
};
