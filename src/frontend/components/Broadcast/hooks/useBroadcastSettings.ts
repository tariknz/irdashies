import { useDashboard } from '@irdashies/context';
import type { BroadcastWidgetSettings } from '@irdashies/types';

export const useBroadcastSettings = ():
  BroadcastWidgetSettings['config'] | undefined => {
  const { currentDashboard } = useDashboard();
  const widget = currentDashboard?.widgets.find((w) => w.id === 'broadcast');
  return widget?.config as unknown as BroadcastWidgetSettings['config'];
};
