import { useMemo } from 'react';
import { useDashboard } from '@irdashies/context';
import { WeatherWidgetSettings } from '@irdashies/types';

export const useWeatherSettings = () => {
  const { currentDashboard } = useDashboard();

  return useMemo(
    () =>
      currentDashboard?.widgets.find((w) => w.id === 'weather')
        ?.config as unknown as WeatherWidgetSettings['config'],
    [currentDashboard]
  );
};
