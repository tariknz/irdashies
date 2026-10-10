import { useDashboard } from '@irdashies/context';
import type { WidgetConfigMap } from '@irdashies/types';

/** The saved config of a broadcast module (tower, ticker, events, ...). */
export const useBroadcastConfig = <K extends keyof WidgetConfigMap>(id: K) =>
  useDashboard().currentDashboard?.widgets.find((w) => w.id === id)
    ?.config as unknown as WidgetConfigMap[K] | undefined;
