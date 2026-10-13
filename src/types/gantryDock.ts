import type { DashboardLayout, DashboardWidget } from './dashboardLayout';
import {
  GANTRY_DOCK_MAX_PANELS,
  GANTRY_DOCK_WIDGET_TYPES,
  type GantryDockConfig,
  type GantryDockPanel,
  type GantryDockWidgetType,
} from './widgetConfigs';
import {
  isWidgetDisabledForSim,
  type SimWidgetSupportConfig,
} from './simWidgetSupport';
import type { ActiveSimulator } from './simulators';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isDockType = (value: unknown): value is GantryDockWidgetType =>
  (GANTRY_DOCK_WIDGET_TYPES as readonly unknown[]).includes(value);

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0;

/** What a panel shows. Two panels with the same target are duplicates. */
const panelTarget = (panel: GantryDockPanel): string | undefined => {
  if (panel.type !== 'fuel') return panel.type;
  // Unlinked fuel panels are placeholders waiting for a source, not copies.
  return panel.widgetId ? `fuel:${panel.widgetId}` : undefined;
};

/**
 * Reads the saved dock config, which is untrusted. Drops unknown panel types,
 * bad ids, duplicates and anything past the panel limit, and falls back to
 * the defaults for everything else.
 */
export const sanitizeGantryDock = (value: unknown): GantryDockConfig => {
  const source = isRecord(value) ? value : {};
  const rawPanels = Array.isArray(source.panels) ? source.panels : [];

  const panels: GantryDockPanel[] = [];
  const seenIds = new Set<string>();
  const seenTargets = new Set<string>();

  for (const raw of rawPanels) {
    if (panels.length >= GANTRY_DOCK_MAX_PANELS) break;
    if (!isRecord(raw) || !isNonEmptyString(raw.id) || !isDockType(raw.type)) {
      continue;
    }
    if (seenIds.has(raw.id)) continue;

    const panel: GantryDockPanel = { id: raw.id, type: raw.type };
    if (raw.type === 'fuel' && isNonEmptyString(raw.widgetId)) {
      panel.widgetId = raw.widgetId;
    }

    const target = panelTarget(panel);
    if (target !== undefined) {
      if (seenTargets.has(target)) continue;
      seenTargets.add(target);
    }
    seenIds.add(panel.id);
    panels.push(panel);
  }

  return {
    enabled: source.enabled === true,
    arrangement: source.arrangement === 'tabs' ? 'tabs' : 'row',
    panels,
  };
};

export const GANTRY_DOCK_PANEL_LABELS: Readonly<
  Record<GantryDockWidgetType, string>
> = {
  fuel: 'Fuel Calculator',
  map: 'Track Map',
  flatmap: 'Flat Track Map',
};

/**
 * - `ready`: the panel has a widget to render.
 * - `unlinked`: a fuel panel with no fuel layout chosen yet.
 * - `removed`: the widget the panel pointed at is no longer in the dashboard.
 */
export type ResolvedDockPanel =
  | { panel: GantryDockPanel; status: 'ready'; widget: DashboardWidget }
  | { panel: GantryDockPanel; status: 'unlinked' | 'removed' };

export interface ResolvedDock {
  arrangement: GantryDockConfig['arrangement'];
  /** Empty when the dock is turned off. */
  panels: ResolvedDockPanel[];
}

const widgetType = (widget: DashboardWidget) => widget.type || widget.id;

const findDockWidget = (
  panel: GantryDockPanel,
  widgets: readonly DashboardWidget[]
): DashboardWidget | undefined =>
  panel.type === 'fuel'
    ? widgets.find(
        (widget) =>
          widget.id === panel.widgetId && widgetType(widget) === 'fuel'
      )
    : widgets.find((widget) => widgetType(widget) === panel.type);

export interface DockSimFilter {
  support: SimWidgetSupportConfig;
  simulator: ActiveSimulator | null | undefined;
}

/**
 * Works out which dashboard widget each docked panel shows. With `sim`, panels
 * the running sim cannot support are left out, as they are on the overlay.
 */
export const resolveDockPanels = (
  dashboard: DashboardLayout | null | undefined,
  sim?: DockSimFilter
): ResolvedDock => {
  const widgets = dashboard?.widgets ?? [];
  const gantry = widgets.find((widget) => widget.id === 'gantry');
  const dock = sanitizeGantryDock(gantry?.config?.dock);
  if (!dock.enabled) return { arrangement: dock.arrangement, panels: [] };

  const supported = sim
    ? dock.panels.filter(
        (panel) =>
          !isWidgetDisabledForSim(sim.support, panel.type, sim.simulator)
      )
    : dock.panels;

  return {
    arrangement: dock.arrangement,
    panels: supported.map((panel): ResolvedDockPanel => {
      if (panel.type === 'fuel' && !panel.widgetId) {
        return { panel, status: 'unlinked' };
      }
      const widget = findDockWidget(panel, widgets);
      return widget
        ? { panel, status: 'ready', widget }
        : { panel, status: 'removed' };
    }),
  };
};
