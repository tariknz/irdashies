import { useDashboard } from '@irdashies/context';
import type { BroadcastWeatherWidgetSettings } from '@irdashies/types';

export const useBroadcastWeatherSettings = ():
  BroadcastWeatherWidgetSettings['config'] | undefined => {
  const { currentDashboard } = useDashboard();
  const widget = currentDashboard?.widgets.find(
    (w) => w.id === 'broadcastweather'
  );
  return widget?.config as unknown as BroadcastWeatherWidgetSettings['config'];
};
