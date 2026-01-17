import type { DashboardWidget } from '@irdashies/types';
import { BrowserWindow } from 'electron';
import { updateDashboardWidget, getDashboard, getCurrentProfileId } from './storage/dashboards';

export const trackWindowMovement = (
  widget: DashboardWidget,
  browserWindow: BrowserWindow
) => {
  // Tracks dragged events on window and updates the widget layout
  browserWindow.on('moved', () => updateWidgetLayout(browserWindow, widget.id));
  browserWindow.on('resized', () => updateWidgetLayout(browserWindow, widget.id));
};

function updateWidgetLayout(
  browserWindow: BrowserWindow,
  widgetId: string
) {
  // Get current active profile instead of hardcoded default
  const currentProfileId = getCurrentProfileId();
  const dashboard = getDashboard(currentProfileId);
  if (!dashboard) return;

  // Find the current widget (with latest config)
  const currentWidget = dashboard.widgets.find((w) => w.id === widgetId);
  if (!currentWidget) return;

  // Update only the layout properties (position and size)
  const [x, y] = browserWindow.getPosition();
  const [width, height] = browserWindow.getSize();

  const updatedWidget: DashboardWidget = {
    ...currentWidget,
    layout: {
      ...currentWidget.layout,
      x,
      y,
      width,
      height,
    },
  };

  updateDashboardWidget(updatedWidget, currentProfileId);
}
