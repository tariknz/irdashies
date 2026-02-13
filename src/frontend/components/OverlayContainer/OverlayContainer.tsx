import { memo, useCallback } from 'react';
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

  const handleLayoutChange = useCallback(
    (widgetId: string, layout: WidgetLayout) => {
      if (!currentDashboard || !onDashboardUpdated) return;

      const updatedWidgets = currentDashboard.widgets.map((widget) =>
        widget.id === widgetId ? { ...widget, layout } : widget
      );

      onDashboardUpdated(
        { ...currentDashboard, widgets: updatedWidgets },
        { skipWindowRefresh: true }
      );
    },
    [currentDashboard, onDashboardUpdated]
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
            {running || widget.alwaysEnabled ? (
              <WidgetComponent {...widget.config} />
            ) : null}
          </WidgetContainer>
        );
      })}

      {/* Exit edit mode button - centered, 50px from top */}
      {editMode && (
        <button
          onClick={handleExitEditMode}
          className="pointer-events-auto fixed top-[50px] left-1/2 -translate-x-1/2 z-9999 flex items-center gap-2 px-3 py-2 bg-sky-500 hover:bg-sky-600 text-white rounded shadow-lg transition-colors cursor-pointer"
        >
          <XIcon size={18} weight="bold" />
          <span className="text-sm font-medium">Exit Edit Mode</span>
        </button>
      )}
    </div>
  );
});

OverlayContainer.displayName = 'OverlayContainer';
