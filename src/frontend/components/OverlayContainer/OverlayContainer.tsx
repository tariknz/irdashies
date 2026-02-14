import { memo, useCallback, useEffect, useRef } from 'react';
import { useDashboard, useRunningState } from '@irdashies/context';
import type { WidgetLayout } from '@irdashies/types';
import { WidgetContainer } from '../WidgetContainer';
import { WIDGET_MAP } from '../../WidgetIndex';
import { XIcon } from '@phosphor-icons/react';

export const OverlayContainer = memo(() => {
  const { currentDashboard, editMode, onDashboardUpdated, bridge } =
    useDashboard();
  const { running } = useRunningState();

  const handleExitEditMode = useCallback(() => {
    bridge.toggleLockOverlays();
  }, [bridge]);

  // Use refs so handleLayoutChange is stable and doesn't cause all
  // WidgetContainers to re-render when any single widget is moved
  const dashboardRef = useRef(currentDashboard);
  const onDashboardUpdatedRef = useRef(onDashboardUpdated);
  useEffect(() => {
    dashboardRef.current = currentDashboard;
  }, [currentDashboard]);
  useEffect(() => {
    onDashboardUpdatedRef.current = onDashboardUpdated;
  }, [onDashboardUpdated]);

  const handleLayoutChange = useCallback(
    (widgetId: string, layout: WidgetLayout) => {
      const dashboard = dashboardRef.current;
      const updateFn = onDashboardUpdatedRef.current;
      if (!dashboard || !updateFn) return;

      const updatedWidgets = dashboard.widgets.map((widget) =>
        widget.id === widgetId ? { ...widget, layout } : widget
      );

      updateFn(
        { ...dashboard, widgets: updatedWidgets },
        { skipWindowRefresh: true }
      );
    },
    []
  );

  if (!currentDashboard) {
    return null;
  }

  const enabledWidgets = currentDashboard.widgets.filter(
    (widget) => widget.enabled
  );

  return (
    <div
      className={[
        'fixed inset-0 overflow-hidden pointer-events-none',
        editMode ? 'bg-blue-900/20' : '',
      ].join(' ')}
    >
      {enabledWidgets.map((widget, index) => {
        const WidgetComponent = WIDGET_MAP[widget.type || widget.id];
        if (!WidgetComponent) {
          return null;
        }

        return (
          <WidgetContainer
            key={widget.id}
            widget={widget}
            editMode={editMode}
            zIndex={index + 1}
            onLayoutChange={handleLayoutChange}
          >
            {running ? <WidgetComponent {...widget.config} /> : null}
          </WidgetContainer>
        );
      })}

      {/* Exit edit mode button - centered, 50px from top */}
      {editMode && (
        <button
          onClick={handleExitEditMode}
          className="pointer-events-auto fixed top-12.5 left-1/2 -translate-x-1/2 z-9999 flex items-center gap-2 px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded shadow-lg transition-colors cursor-pointer"
        >
          <XIcon size={18} weight="bold" />
          <span className="text-sm font-medium">Exit Edit Mode</span>
        </button>
      )}
    </div>
  );
});

OverlayContainer.displayName = 'OverlayContainer';
