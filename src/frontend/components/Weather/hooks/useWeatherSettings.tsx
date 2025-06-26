import { useDashboard } from '@irdashies/context';
import { WeatherWidgetSettings } from '../../Settings/types';

export const useWeatherSettings = () => {
  const { currentDashboard } = useDashboard();

  const weatherSettings = currentDashboard?.widgets.find(
    (widget) => widget.id === 'weather',
  )?.config;
  
  return weatherSettings as WeatherWidgetSettings['config'];
}; 