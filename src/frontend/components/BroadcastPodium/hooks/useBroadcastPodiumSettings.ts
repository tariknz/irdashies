import { useDashboard } from '@irdashies/context';
import type { BroadcastPodiumWidgetSettings } from '@irdashies/types';

export const useBroadcastPodiumSettings = ():
  BroadcastPodiumWidgetSettings['config'] | undefined => {
  const { currentDashboard } = useDashboard();
  const widget = currentDashboard?.widgets.find(
    (w) => w.id === 'broadcastpodium'
  );
  return widget?.config as unknown as BroadcastPodiumWidgetSettings['config'];
};
