import { useMemo } from 'react';
import { useDashboard } from '@irdashies/context';
import {
  getWidgetDefaultConfig,
  type GantryWidgetSettings,
} from '@irdashies/types';

const defaultConfig = getWidgetDefaultConfig('gantry');

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSessionRetention = (value: unknown) =>
  value === 'all' || value === 5 || value === 10 || value === 20;

const isGantryConfig = (
  config: object | undefined
): config is GantryWidgetSettings['config'] => {
  if (!isObjectRecord(config)) return false;

  const { units, sessionRetention } = config;

  // `units` was added after the widget shipped, so a saved dashboard that
  // predates it is still valid — it falls back to 'auto' below.
  const unitsValid =
    units === undefined ||
    units === 'auto' ||
    units === 'Metric' ||
    units === 'Imperial';

  return (
    unitsValid &&
    isSessionRetention(sessionRetention) &&
    typeof config.slowSpeedThreshold === 'number' &&
    typeof config.slowFrameThreshold === 'number' &&
    typeof config.suddenStopFromSpeed === 'number' &&
    typeof config.suddenStopToSpeed === 'number' &&
    typeof config.suddenStopFrames === 'number' &&
    typeof config.offTrackDebounce === 'number' &&
    typeof config.pitEntryDebounce === 'number' &&
    typeof config.cooldownSeconds === 'number'
  );
};

export const useGantrySettings = (): GantryWidgetSettings['config'] => {
  const { currentDashboard } = useDashboard();

  return useMemo(() => {
    const config = currentDashboard?.widgets.find(
      (w) => w.id === 'gantry'
    )?.config;

    if (!isGantryConfig(config)) return defaultConfig;

    return { ...config, units: config.units ?? 'auto' };
  }, [currentDashboard]);
};
