import { useDashboard } from '@irdashies/context';
import { InputTraceWidgetSettings } from '@irdashies/types';

export const useInputTraceSettings = () => {
  const { currentDashboard } = useDashboard();

  const settings = currentDashboard?.widgets.find(
    (widget) => widget.id === 'inputtrace'
  )?.config;

  if (
    settings &&
    typeof settings === 'object' &&
    'trace' in settings &&
    typeof settings.trace === 'object'
  ) {
    return settings as unknown as InputTraceWidgetSettings['config'];
  }

  return undefined;
};
