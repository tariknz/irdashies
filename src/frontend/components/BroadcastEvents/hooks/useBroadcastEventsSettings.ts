import { useDashboard } from '@irdashies/context';
import type { BroadcastEventsWidgetSettings } from '@irdashies/types';

export const useBroadcastEventsSettings = ():
  BroadcastEventsWidgetSettings['config'] | undefined => {
  const { currentDashboard } = useDashboard();
  const widget = currentDashboard?.widgets.find(
    (w) => w.id === 'broadcastevents'
  );
  return widget?.config as unknown as BroadcastEventsWidgetSettings['config'];
};
