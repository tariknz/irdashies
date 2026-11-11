import { useDashboard } from '@irdashies/context';
import { defaultFuelCalculatorSettings } from './defaults';
import type { FuelCalculatorSettings } from './types';

export function useFuelCalculatorSettings(
  props: Partial<FuelCalculatorSettings>
) {
  const { currentDashboard } = useDashboard();
  const saved = currentDashboard?.widgets?.find(
    (widget) => widget.id === 'fuel' || widget.type === 'fuel'
  )?.config as Partial<FuelCalculatorSettings> | undefined;
  return { ...defaultFuelCalculatorSettings, ...saved, ...props };
}
