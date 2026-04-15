import { useEffect, useRef } from 'react';
import { useDashboard } from '../../../src/frontend/context/DashboardContext/DashboardContext';

/**
 * Syncs the toolbar's activeWidgets set into the dashboard context so the
 * settings panel's enabled toggle stays in sync with the Frame toolbar.
 */
export function ActiveWidgetSync({
  activeWidgets,
}: {
  activeWidgets: Set<string>;
}) {
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  const prevActiveRef = useRef<Set<string>>(activeWidgets);

  useEffect(() => {
    if (!currentDashboard || !onDashboardUpdated) return;
    // Only sync when activeWidgets actually changed (skip initial render)
    if (prevActiveRef.current === activeWidgets) return;
    prevActiveRef.current = activeWidgets;

    const needsUpdate = currentDashboard.widgets.some((w) => {
      const id = w.type ?? w.id;
      return w.enabled !== activeWidgets.has(id);
    });

    if (!needsUpdate) return;

    const updatedWidgets = currentDashboard.widgets.map((w) => {
      const id = w.type ?? w.id;
      const shouldBeEnabled = activeWidgets.has(id);
      if (w.enabled === shouldBeEnabled) return w;
      return { ...w, enabled: shouldBeEnabled };
    });

    onDashboardUpdated({ ...currentDashboard, widgets: updatedWidgets });
  }, [activeWidgets, currentDashboard, onDashboardUpdated]);

  return null;
}
