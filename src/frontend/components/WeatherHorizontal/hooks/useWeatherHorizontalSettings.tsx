import { useMemo } from 'react';
import { useDashboard } from '@irdashies/context';
import type { WeatherHorizontalWidgetSettings } from '@irdashies/types';

export const useWeatherHorizontalSettings = () => {
  const { currentDashboard } = useDashboard();

  return useMemo(
    () =>
      currentDashboard?.widgets.find((w) => w.id === 'weatherhorizontal')
        ?.config as unknown as WeatherHorizontalWidgetSettings['config'],
    [currentDashboard]
  );
};
