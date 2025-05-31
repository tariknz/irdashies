import type { DashboardLayout, DashboardWidget } from '@irdashies/types';
import { emitDashboardUpdated } from './dashboardEvents';
import { defaultDashboard } from './defaultDashboard';
import { readData, writeData } from './storage';

const DASHBOARDS_KEY = 'dashboards';

const isDashboardChanged = (oldDashboard: DashboardLayout | undefined, newDashboard: DashboardLayout): boolean => {
  if (!oldDashboard) return true;

  // Compare generalSettings
  if (JSON.stringify(oldDashboard.generalSettings) !== JSON.stringify(newDashboard.generalSettings)) {
    return true;
  }

  // Compare widgets length
  if (oldDashboard.widgets.length !== newDashboard.widgets.length) return true;

  // Compare each widget
  return oldDashboard.widgets.some((oldWidget, index) => {
    const newWidget = newDashboard.widgets[index];
    return JSON.stringify(oldWidget) !== JSON.stringify(newWidget);
  });
};

export const getOrCreateDefaultDashboard = () => {
  const dashboard = getDashboard('default');
  if (dashboard) {
    // check missing widgets
    const missingWidgets = defaultDashboard.widgets.filter(
      (defaultWidget) =>
        !dashboard.widgets.find((widget) => widget.id === defaultWidget.id)
    );

    // add missing widgets and save
    const updatedDashboard = {
      ...dashboard,
      generalSettings: {
        ...defaultDashboard.generalSettings,
        ...dashboard.generalSettings,
      },
      widgets: [...dashboard.widgets, ...missingWidgets].map((widget) => {
        // add missing default widget config
        const defaultWidget = defaultDashboard.widgets.find((w) => w.id === widget.id);
        if (!widget.config && defaultWidget?.config) {
          return { ...widget, config: defaultWidget.config };
        }
        return widget;
      }),
    };

    saveDashboard('default', updatedDashboard);
    return updatedDashboard;
  }

  saveDashboard('default', defaultDashboard);

  return defaultDashboard;
};

export const listDashboards = () => {
  const dashboards = readData<Record<string, DashboardLayout>>(DASHBOARDS_KEY);
  if (!dashboards) return {};

  return dashboards;
};

export const getDashboard = (id: string) => {
  const dashboards = readData<Record<string, DashboardLayout>>(DASHBOARDS_KEY);
  if (!dashboards) return null;

  return dashboards[id];
};

export const updateDashboardWidget = (
  updatedWidget: DashboardWidget,
  dashboardId = 'default'
) => {
  const dashboard = getDashboard(dashboardId);
  if (!dashboard) {
    throw new Error('Default dashboard not found');
  }

  const updatedDashboard = {
    widgets: dashboard.widgets.map((existingWidget) =>
      existingWidget.id === updatedWidget.id ? updatedWidget : existingWidget
    ),
  };

  saveDashboard(dashboardId, updatedDashboard);
};

export const saveDashboard = (
  id: string | 'default',
  value: DashboardLayout
) => {
  const dashboards = listDashboards();
  const existingDashboard = dashboards[id];

  // Merge the existing dashboard with the new value to preserve structure
  const mergedDashboard: DashboardLayout = {
    ...existingDashboard,
    ...value,
    widgets: value.widgets || existingDashboard?.widgets || [],
    generalSettings: {
      ...existingDashboard?.generalSettings,
      ...value.generalSettings,
    }
  };

  // Only save and emit if there are actual changes
  if (isDashboardChanged(existingDashboard, mergedDashboard)) {
    dashboards[id] = mergedDashboard;
    writeData(DASHBOARDS_KEY, dashboards);
    emitDashboardUpdated(mergedDashboard);
  }
};
