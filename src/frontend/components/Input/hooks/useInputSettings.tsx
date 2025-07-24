import { useDashboard } from '@irdashies/context'
import { InputWidgetSettings } from '../../Settings/types';

export const useInputSettings = () => {
  const { currentDashboard } = useDashboard();

  const inputSettings = currentDashboard?.widgets.find(
    (widget) => widget.id === 'input',
  )?.config;

  // Add type guard to ensure inputSettings matches expected shape
  if (inputSettings && 
    typeof inputSettings === 'object' &&
    'trace' in inputSettings && 
    'bar' in inputSettings && 
    'gear' in inputSettings &&
    typeof inputSettings.trace === 'object' &&
    typeof inputSettings.bar === 'object' &&
    typeof inputSettings.gear === 'object'
  ) {
    return inputSettings as unknown as InputWidgetSettings['config'];
  }

  return undefined;
};

