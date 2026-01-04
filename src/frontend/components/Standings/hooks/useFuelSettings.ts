import { useDashboard } from '@irdashies/context';
import { FuelWidgetSettings } from '../../Settings/types';

export const useFuelSettings = (): FuelWidgetSettings['config'] => {
  const { currentDashboard } = useDashboard();
  const widget = currentDashboard?.widgets.find(w => w.id === 'fuel')?.config;
  return widget as FuelWidgetSettings['config'];
};