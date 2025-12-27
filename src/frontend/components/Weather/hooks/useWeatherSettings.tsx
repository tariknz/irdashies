import { useDashboard } from '@irdashies/context';
import { WeatherWidgetSettings } from '../../Settings/types';
import { useMemo } from 'react';

const defaultConfig: WeatherWidgetSettings['config'] = {
  background: { opacity: 0 },
  units: 'auto',
  airTemp: {
    enabled: true
  },
  trackTemp: {
    enabled: true
  },
  wetness: {
    enabled: true
  },
  trackState: {
    enabled: true
  },
  wind: {
    enabled: true
  }
};

export const useWeatherSettings = () => {
  const { currentDashboard } = useDashboard();

  return useMemo(() => {
    const weatherSettings = currentDashboard?.widgets.find(
      (widget) => widget.id === 'weather',
    )?.config;

    return { ...defaultConfig, ...(weatherSettings as WeatherWidgetSettings['config']) };
  }, [currentDashboard]);
}; 