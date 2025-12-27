import { useDashboard } from '@irdashies/context';
import { WeatherWidgetSettings } from '../../Settings/types';
import { useMemo } from 'react';

const defaultConfig: WeatherWidgetSettings['config'] = {
  background: { opacity: 0 },
  includeAirTemp: true,
  includeTrackTemp: true,
  includeWind: false,
  includeWetness: false,
  includeTrackState: false
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