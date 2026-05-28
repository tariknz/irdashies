import { useDashboard } from '@irdashies/context';
import { getWidgetDefaultConfig } from '@irdashies/types';
import type { HeartRateWidgetSettings } from '@irdashies/types';

const defaultConfig = getWidgetDefaultConfig('heartrate');

export const useHeartRateSettings = (): HeartRateWidgetSettings => {
  const { currentDashboard } = useDashboard();

  const saved = currentDashboard?.widgets.find((w) => w.id === 'heartrate') as
    | HeartRateWidgetSettings
    | undefined;

  if (saved && typeof saved === 'object') {
    return {
      enabled: saved.enabled ?? false,
      config: { ...defaultConfig, ...saved.config },
    };
  }

  return { enabled: false, config: defaultConfig };
};
