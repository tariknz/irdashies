import { useMemo } from 'react';
import { useDashboard } from '@irdashies/context';
import {
  getWidgetDefaultConfig,
  type WindWidgetSettings,
} from '@irdashies/types';

const defaultConfig = getWidgetDefaultConfig('wind');

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSessionVisibility = (value: unknown) => {
  if (!isObjectRecord(value)) return false;

  return (
    typeof value.race === 'boolean' &&
    typeof value.loneQualify === 'boolean' &&
    typeof value.openQualify === 'boolean' &&
    typeof value.practice === 'boolean' &&
    typeof value.offlineTesting === 'boolean'
  );
};

const isWindConfig = (
  config: object | undefined
): config is WindWidgetSettings['config'] => {
  if (!isObjectRecord(config)) return false;

  const { background, units, showOnlyWhenOnTrack, sessionVisibility } = config;

  return (
    isObjectRecord(background) &&
    typeof background.opacity === 'number' &&
    (units === 'auto' || units === 'Metric' || units === 'Imperial') &&
    typeof showOnlyWhenOnTrack === 'boolean' &&
    isSessionVisibility(sessionVisibility)
  );
};

export const useWindSettings = (): WindWidgetSettings['config'] => {
  const { currentDashboard } = useDashboard();

  return useMemo(() => {
    const config = currentDashboard?.widgets.find(
      (w) => w.id === 'wind'
    )?.config;

    return isWindConfig(config) ? config : defaultConfig;
  }, [currentDashboard]);
};
