import { useDashboard } from '@irdashies/context';
import { FuelWidgetSettings } from '../../Settings/types';

export const useFuelSettings = (): FuelWidgetSettings['config'] => {
  const { currentDashboard } = useDashboard();
  // Try to find the main 'fuel' widget, or any widget of type 'fuel'
  const widget = currentDashboard?.widgets.find(w => w.id === 'fuel' || w.type === 'fuel')?.config;
  return widget as FuelWidgetSettings['config'];
};