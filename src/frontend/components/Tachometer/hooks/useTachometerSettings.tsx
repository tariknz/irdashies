import { useDashboard } from '@irdashies/context';
import type { TachometerWidgetSettings, DashboardWidget } from '@irdashies/types';

const SETTING_ID = 'tachometer';

export const useTachometerSettings = () => {
  const { currentDashboard } = useDashboard();
  const widget = currentDashboard?.widgets?.find((w: DashboardWidget) => w.id === SETTING_ID);
  return widget?.config as TachometerWidgetSettings['config'] | undefined;
};
