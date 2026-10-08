import { useDashboard } from '@irdashies/context';
import { InputWidgetSettings } from '@irdashies/types';

type InputConfig = InputWidgetSettings['config'];

export const isInputConfig = (value: unknown): value is InputConfig =>
  !!value &&
  typeof value === 'object' &&
  'trace' in value &&
  'bar' in value &&
  'gear' in value &&
  typeof value.trace === 'object' &&
  typeof value.bar === 'object' &&
  typeof value.gear === 'object';

export const useInputSettings = () => {
  const { currentDashboard } = useDashboard();

  const inputSettings = currentDashboard?.widgets.find(
    (widget) => widget.id === 'input'
  )?.config;

  return isInputConfig(inputSettings) ? inputSettings : undefined;
};
