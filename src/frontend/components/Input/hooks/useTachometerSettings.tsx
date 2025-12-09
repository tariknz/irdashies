import { useDashboard } from '@irdashies/context';
import { InputWidgetSettings } from '../../Settings/types';

/**
 * Hook for tachometer settings from dashboard config.
 * Encapsulates all tachometer configuration.
 */
export const useTachometerSettings = () => {
  const { currentDashboard } = useDashboard();

  const inputSettings = currentDashboard?.widgets.find(
    (widget) => widget.id === 'input',
  )?.config as InputWidgetSettings['config'] | undefined;

  return {
    enabled: inputSettings?.tachometer?.enabled ?? true,
    showRpmText: inputSettings?.tachometer?.showRpmText ?? false, // Default false
  };
};
