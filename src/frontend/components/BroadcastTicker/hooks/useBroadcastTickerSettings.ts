import { useDashboard } from '@irdashies/context';
import type { BroadcastTickerWidgetSettings } from '@irdashies/types';

export const useBroadcastTickerSettings = ():
  BroadcastTickerWidgetSettings['config'] | undefined => {
  const { currentDashboard } = useDashboard();
  const widget = currentDashboard?.widgets.find(
    (w) => w.id === 'broadcastticker'
  );
  return widget?.config as unknown as BroadcastTickerWidgetSettings['config'];
};
