import { useDashboard } from '@irdashies/context';
import { WeatherWidgetSettings } from '../../Settings/types';

export const useWeatherSettings = () => {
  const { currentDashboard } = useDashboard();
  const widget = currentDashboard?.widgets.find(w => w.id === 'weather')?.config;
  return widget as WeatherWidgetSettings['config'];
}; 