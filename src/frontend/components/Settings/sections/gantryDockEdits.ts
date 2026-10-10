import {
  getWidgetDefaultConfig,
  sanitizeGantryDock,
  type DashboardLayout,
  type DashboardWidget,
  type GantryDockConfig,
} from '@irdashies/types';
import { generateId } from './FuelSettings/utils';

const GANTRY_ID = 'gantry';

export const newDockPanelId = () => `panel-${generateId()}`;
export const newGantryFuelId = () => `fuel-${generateId()}`;

/** The saved dock, cleaned up. */
export const readGantryDock = (
  dashboard: DashboardLayout | undefined
): GantryDockConfig =>
  sanitizeGantryDock(
    dashboard?.widgets.find((widget) => widget.id === GANTRY_ID)?.config?.dock
  );

/** Replaces the Gantry's dock config. Other widgets are left alone. */
export const withGantryDock = (
  dashboard: DashboardLayout,
  update: (dock: GantryDockConfig) => GantryDockConfig
): DashboardLayout => ({
  ...dashboard,
  widgets: dashboard.widgets.map((widget) =>
    widget.id === GANTRY_ID
      ? {
          ...widget,
          config: {
            ...widget.config,
            dock: sanitizeGantryDock(update(readGantryDock(dashboard))),
          },
        }
      : widget
  ),
});

const gantryFuelWidget = (id: string): DashboardWidget => ({
  id,
  type: 'fuel',
  enabled: true,
  placement: 'gantry',
  layout: { x: 50, y: 50, width: 300, height: 220 },
  config: {
    ...(getWidgetDefaultConfig('fuel') as unknown as Record<string, unknown>),
    // The Gantry is mostly used while not driving, so do not hide it then.
    showOnlyWhenOnTrack: false,
  },
});

/**
 * Adds a fuel layout that only the Gantry shows and points the panel at it,
 * in one dashboard update so the two never disagree.
 */
export const createGantryFuelLayout = (
  dashboard: DashboardLayout,
  panelId: string,
  widgetId: string
): DashboardLayout =>
  withGantryDock(
    {
      ...dashboard,
      widgets: [...dashboard.widgets, gantryFuelWidget(widgetId)],
    },
    (dock) => ({
      ...dock,
      panels: dock.panels.map((panel) =>
        panel.id === panelId ? { ...panel, widgetId } : panel
      ),
    })
  );

/** Removes a panel, and the Gantry-only layout it used when asked to. */
export const removeDockPanel = (
  dashboard: DashboardLayout,
  panelId: string,
  deleteLayout: boolean
): DashboardLayout => {
  const panel = readGantryDock(dashboard).panels.find((p) => p.id === panelId);
  const layoutId = deleteLayout ? panel?.widgetId : undefined;
  const widgets = layoutId
    ? dashboard.widgets.filter(
        (widget) => !(widget.id === layoutId && widget.placement === 'gantry')
      )
    : dashboard.widgets;
  return withGantryDock({ ...dashboard, widgets }, (dock) => ({
    ...dock,
    panels: dock.panels.filter((p) => p.id !== panelId),
  }));
};

/**
 * Deletes a fuel layout. A Gantry-only layout also takes its dock panels with
 * it; a panel on an overlay layout stays and says its layout was removed.
 */
export const deleteFuelLayout = (
  dashboard: DashboardLayout,
  widgetId: string
): DashboardLayout => {
  const widget = dashboard.widgets.find((w) => w.id === widgetId);
  const remaining = {
    ...dashboard,
    widgets: dashboard.widgets.filter((w) => w.id !== widgetId),
  };
  if (widget?.placement !== 'gantry') return remaining;
  return withGantryDock(remaining, (dock) => ({
    ...dock,
    panels: dock.panels.filter((panel) => panel.widgetId !== widgetId),
  }));
};
