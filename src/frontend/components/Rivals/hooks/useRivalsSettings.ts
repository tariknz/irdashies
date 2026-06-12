import { useDashboard } from '@irdashies/context';
import { RivalsWidgetSettings } from '@irdashies/types';

export const useRivalsSettings = (): RivalsWidgetSettings['config'] | undefined => {
  const { currentDashboard } = useDashboard();
  const widget = currentDashboard?.widgets.find((w) => w.id === 'rivals')?.config;
  return widget as unknown as RivalsWidgetSettings['config'] | undefined;
};
