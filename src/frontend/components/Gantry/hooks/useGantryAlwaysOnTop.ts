import { useCallback } from 'react';
import { useDashboard } from '@irdashies/context';

/**
 * The saved "keep on top" setting and a setter that writes it through the
 * same dashboard save path Settings uses.
 */
export const useGantryAlwaysOnTop = (): [boolean, (on: boolean) => void] => {
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  const config = currentDashboard?.widgets.find((w) => w.id === 'gantry')
    ?.config as { window?: { alwaysOnTop?: unknown } } | undefined;
  const alwaysOnTop = config?.window?.alwaysOnTop === true;

  const setAlwaysOnTop = useCallback(
    (on: boolean) => {
      if (!currentDashboard || !onDashboardUpdated) return;
      onDashboardUpdated({
        ...currentDashboard,
        widgets: currentDashboard.widgets.map((widget) => {
          if (widget.id !== 'gantry') return widget;
          const saved = widget.config?.window;
          return {
            ...widget,
            config: {
              ...widget.config,
              window: {
                ...(typeof saved === 'object' ? saved : {}),
                alwaysOnTop: on,
              },
            },
          };
        }),
      });
    },
    [currentDashboard, onDashboardUpdated]
  );

  return [alwaysOnTop, setAlwaysOnTop];
};
