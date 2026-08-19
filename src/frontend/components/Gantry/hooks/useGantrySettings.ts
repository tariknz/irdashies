import { useDashboard } from '@irdashies/context';
import type { GantryWidgetSettings } from '@irdashies/types';

/**
 * The Gantry's own widget config, or undefined until the dashboard has loaded.
 * Callers must supply their own fallback rather than assume a value.
 */
export const useGantrySettings = ():
  GantryWidgetSettings['config'] | undefined => {
  const { currentDashboard } = useDashboard();

  return currentDashboard?.widgets.find((widget) => widget.id === 'gantry')
    ?.config as GantryWidgetSettings['config'] | undefined;
};
