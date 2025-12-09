import { useDashboard } from '@irdashies/context';

/**
 * Hook for tachometer settings from dashboard config.
 * Encapsulates all tachometer configuration.
 */
export const useTachometerSettings = () => {
  const { currentDashboard } = useDashboard();

  const inputSettings = currentDashboard?.widgets.find(
    (widget) => widget.id === 'input',
  )?.config;

  return {
    enabled: (inputSettings as any)?.tachometer?.enabled ?? true,
    showRpmText: (inputSettings as any)?.tachometer?.showRpmText ?? false, // Default false
  };
};
