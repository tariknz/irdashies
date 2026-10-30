import {
  deepMergeConfig,
  getWidgetDefaultConfig,
  OVERLAY_STANDINGS_ID,
  sanitizeGantryStandings,
  type DashboardLayout,
  type DashboardWidget,
  type GantryStandingsConfig,
} from '@irdashies/types';
import { generateId } from './FuelSettings/utils';

const GANTRY_ID = 'gantry';

export const newGantryStandingsId = () => `standings-${generateId()}`;

/** The saved standings choice, cleaned up. */
export const readGantryStandings = (
  dashboard: DashboardLayout | undefined
): GantryStandingsConfig =>
  sanitizeGantryStandings(
    dashboard?.widgets.find((widget) => widget.id === GANTRY_ID)?.config
      ?.standings
  );

/** Replaces the Gantry's standings choice. Other widgets are left alone. */
export const withGantryStandings = (
  dashboard: DashboardLayout,
  standings: GantryStandingsConfig
): DashboardLayout => ({
  ...dashboard,
  widgets: dashboard.widgets.map((widget) =>
    widget.id === GANTRY_ID
      ? {
          ...widget,
          config: {
            ...widget.config,
            standings: sanitizeGantryStandings(standings),
          },
        }
      : widget
  ),
});

/**
 * The overlay's standings settings with the parts that do not suit a tall,
 * always-visible Gantry panel set aside. `showAll` keeps the copy's own value
 * when it has one.
 */
const gantryStandingsConfig = (
  dashboard: DashboardLayout,
  current?: Record<string, unknown>
): Record<string, unknown> => {
  const defaults = getWidgetDefaultConfig('standings') as unknown as Record<
    string,
    unknown
  >;
  const overlay = dashboard.widgets.find(
    (widget) => widget.id === OVERLAY_STANDINGS_ID
  )?.config;
  const config = deepMergeConfig(defaults, structuredClone(overlay ?? {}));
  const currentShowAll = (
    current?.driverStandings as Record<string, unknown> | undefined
  )?.showAll;
  return {
    ...config,
    showOnlyWhenOnTrack: false,
    driverStandings: {
      ...(config.driverStandings as Record<string, unknown>),
      showAll: typeof currentShowAll === 'boolean' ? currentShowAll : true,
    },
  };
};

const overlayScale = (dashboard: DashboardLayout) =>
  dashboard.widgets.find((widget) => widget.id === OVERLAY_STANDINGS_ID)?.scale;

const isGantryStandings = (widget: DashboardWidget, widgetId: string) =>
  widget.id === widgetId &&
  widget.placement === 'gantry' &&
  (widget.type || widget.id) === 'standings';

/**
 * Adds a Standings layout that only the Gantry shows, copied from the overlay
 * one, and points the Gantry at it, in one update so the two never disagree.
 */
export const createGantryStandingsLayout = (
  dashboard: DashboardLayout,
  widgetId: string
): DashboardLayout => {
  const widget: DashboardWidget = {
    id: widgetId,
    type: 'standings',
    enabled: true,
    placement: 'gantry',
    layout: { x: 50, y: 50, width: 560, height: 774 },
    config: gantryStandingsConfig(dashboard),
  };
  const scale = overlayScale(dashboard);
  if (scale !== undefined) widget.scale = scale;
  return withGantryStandings(
    { ...dashboard, widgets: [...dashboard.widgets, widget] },
    { source: 'gantry', widgetId }
  );
};

/** Overwrites a Gantry-only layout with the overlay's current settings. */
export const copyOverlayToGantryStandings = (
  dashboard: DashboardLayout,
  widgetId: string
): DashboardLayout => ({
  ...dashboard,
  widgets: dashboard.widgets.map((widget) => {
    if (!isGantryStandings(widget, widgetId)) return widget;
    const next: DashboardWidget = {
      ...widget,
      config: gantryStandingsConfig(dashboard, widget.config),
    };
    const scale = overlayScale(dashboard);
    if (scale === undefined) delete next.scale;
    else next.scale = scale;
    return next;
  }),
});

/**
 * Deletes a Gantry-only Standings layout. If the Gantry was showing it, the
 * Gantry goes back to its built-in table.
 */
export const deleteGantryStandingsLayout = (
  dashboard: DashboardLayout,
  widgetId: string
): DashboardLayout => {
  const remaining = {
    ...dashboard,
    widgets: dashboard.widgets.filter(
      (widget) => !isGantryStandings(widget, widgetId)
    ),
  };
  return readGantryStandings(dashboard).widgetId === widgetId
    ? withGantryStandings(remaining, { source: 'builtin' })
    : remaining;
};
