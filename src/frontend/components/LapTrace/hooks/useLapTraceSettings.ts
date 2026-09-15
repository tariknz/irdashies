import { useMemo } from 'react';
import { useDashboard } from '@irdashies/context';
import {
  getWidgetDefaultConfig,
  type LapTraceWidgetSettings,
} from '@irdashies/types';

const defaultConfig = getWidgetDefaultConfig('laptrace');

const isObjectRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isLapTraceConfig = (
  config: object | undefined
): config is LapTraceWidgetSettings['config'] => {
  if (!isObjectRecord(config)) return false;

  const { referenceSource, metersBehind, metersAhead, showGhost } = config;

  return (
    (referenceSource === 'best' ||
      referenceSource === 'manual' ||
      referenceSource === 'garage61') &&
    typeof metersBehind === 'number' &&
    typeof metersAhead === 'number' &&
    typeof showGhost === 'boolean'
  );
};

export const useLapTraceSettings = (): LapTraceWidgetSettings['config'] => {
  const { currentDashboard } = useDashboard();

  return useMemo(() => {
    const config = currentDashboard?.widgets.find(
      (w) => w.id === 'laptrace'
    )?.config;

    return isLapTraceConfig(config)
      ? { ...defaultConfig, ...config }
      : defaultConfig;
  }, [currentDashboard]);
};
