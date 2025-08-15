import { useDashboard } from '@irdashies/context';
import { RelativeWidgetSettings } from '../../Settings/types';

export const useRelativeSettings = (): RelativeWidgetSettings['config'] => {
  const { currentDashboard } = useDashboard();
  const widget = currentDashboard?.widgets.find(w => w.id === 'relative')?.config;
  return widget as RelativeWidgetSettings['config'];
};