import { useMemo } from 'react';
import { useDashboard } from '@irdashies/context';
import {
  getWidgetDefaultConfig,
  type RadarWidgetSettings,
} from '@irdashies/types';

const defaults = getWidgetDefaultConfig('radar');

/** The saved radar config with any missing field taken from the defaults. */
export const useRadarSettings = (): RadarWidgetSettings['config'] => {
  const { currentDashboard } = useDashboard();
  const saved = currentDashboard?.widgets.find(
    (widget) => widget.id === 'radar'
  )?.config as Partial<RadarWidgetSettings['config']> | undefined;

  return useMemo(
    () => ({
      ...defaults,
      ...saved,
      background: { ...defaults.background, ...saved?.background },
      sessionVisibility: {
        ...defaults.sessionVisibility,
        ...saved?.sessionVisibility,
      },
    }),
    [saved]
  );
};
