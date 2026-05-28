import { useDashboard } from '@irdashies/context';
import { getWidgetDefaultConfig, deepMergeConfig } from '@irdashies/types';
import type { HeartRateConfig, HeartRateWidgetSettings } from '@irdashies/types';

const defaultConfig = getWidgetDefaultConfig('heartrate');

export const useHeartRateSettings = (): HeartRateWidgetSettings => {
  const { currentDashboard } = useDashboard();

  const saved = currentDashboard?.widgets.find((w) => w.id === 'heartrate') as
    | HeartRateWidgetSettings
    | undefined;

  if (saved && typeof saved === 'object') {
    return {
      enabled: saved.enabled ?? false,
      // Deep merge so a partial saved config (e.g. nested sessionVisibility)
      // doesn't drop the other default flags.
      config: deepMergeConfig(
        defaultConfig as unknown as Record<string, unknown>,
        saved.config
      ) as unknown as HeartRateConfig,
    };
  }

  return { enabled: false, config: defaultConfig };
};
