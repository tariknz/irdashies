import { useMemo } from 'react';
import { useDashboard } from '@irdashies/context';
import {
  deepMergeConfig,
  getWidgetDefaultConfig,
  getWidgetManifest,
  isConfigValid,
  type WindWidgetSettings,
} from '@irdashies/types';

const defaultConfig = getWidgetDefaultConfig('wind');

// Fill values a saved config predates from the defaults first, so adding a
// property to the manifest doesn't invalidate every saved wind config.
const withDefaults = (config: unknown) =>
  deepMergeConfig(
    defaultConfig as unknown as Record<string, unknown>,
    config
  ) as unknown as WindWidgetSettings['config'];

const isWindConfig = (config: unknown) =>
  isConfigValid(
    getWidgetManifest('wind')?.properties ?? {},
    withDefaults(config)
  );

export const useWindSettings = (): WindWidgetSettings['config'] => {
  const { currentDashboard } = useDashboard();

  return useMemo(() => {
    const config = currentDashboard?.widgets.find(
      (w) => w.id === 'wind'
    )?.config;

    return isWindConfig(config) ? withDefaults(config) : defaultConfig;
  }, [currentDashboard]);
};
