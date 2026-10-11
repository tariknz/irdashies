import { useMemo } from 'react';
import { useDashboard } from '@irdashies/context';
import {
  getWidgetDefaultConfig,
  getWidgetManifest,
  isConfigValid,
  type WindWidgetSettings,
} from '@irdashies/types';

const defaultConfig = getWidgetDefaultConfig('wind');

const isWindConfig = (
  config: unknown
): config is WindWidgetSettings['config'] =>
  isConfigValid(getWidgetManifest('wind')?.properties ?? {}, config);

export const useWindSettings = (): WindWidgetSettings['config'] => {
  const { currentDashboard } = useDashboard();

  return useMemo(() => {
    const config = currentDashboard?.widgets.find(
      (w) => w.id === 'wind'
    )?.config;

    return isWindConfig(config) ? config : defaultConfig;
  }, [currentDashboard]);
};
