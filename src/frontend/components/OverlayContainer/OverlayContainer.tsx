import { memo, useCallback } from 'react';
import { useDashboard, useRunningState } from '@irdashies/context';
import type { WidgetLayout } from '@irdashies/types';
import { WidgetContainer } from '../WidgetContainer';
import { WIDGET_MAP } from '../../WidgetIndex';

export const OverlayContainer = memo(() => {
  const { currentDashboard, editMode, onDashboardUpdated } = useDashboard();
  const { running } = useRunningState();

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
    <div className="fixed inset-0 overflow-hidden">
      {enabledWidgets.map((widget, index) => {
        const WidgetComponent = WIDGET_MAP[widget.id];
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
    </div>
  );
});

OverlayContainer.displayName = 'OverlayContainer';
