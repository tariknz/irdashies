import type { DashboardLayout, DashboardWidget } from './dashboardLayout';
import {
  GANTRY_STANDINGS_SOURCES,
  type GantryStandingsConfig,
  type GantryStandingsSource,
} from './widgetConfigs';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isSource = (value: unknown): value is GantryStandingsSource =>
  (GANTRY_STANDINGS_SOURCES as readonly unknown[]).includes(value);

/**
 * Reads the saved standings choice, which is untrusted. An unknown source
 * means the built-in table. The Gantry-only layout id is kept whatever the
 * source, so switching away and back finds the layout again.
 */
export const sanitizeGantryStandings = (
  value: unknown
): GantryStandingsConfig => {
  const saved = isRecord(value) ? value : {};
  const standings: GantryStandingsConfig = {
    source: isSource(saved.source) ? saved.source : 'builtin',
  };
  if (typeof saved.widgetId === 'string' && saved.widgetId.length > 0) {
    standings.widgetId = saved.widgetId;
  }
  return standings;
};

/**
 * - `builtin`: the Gantry's own table.
 * - `overlay` / `gantry`: render this Standings widget in the Gantry.
 * - `unlinked`: Gantry-only was chosen but no layout exists yet.
 * - `removed`: the Gantry-only layout is no longer in the dashboard.
 */
export type ResolvedGantryStandings =
  | { status: 'builtin' }
  | { status: 'ready'; source: 'overlay' | 'gantry'; widget: DashboardWidget }
  | { status: 'unlinked' | 'removed'; source: 'gantry' };

const widgetType = (widget: DashboardWidget) => widget.type || widget.id;

export const OVERLAY_STANDINGS_ID = 'standings';

/** Works out which dashboard widget the Gantry's standings pane shows. */
export const resolveGantryStandings = (
  dashboard: DashboardLayout | null | undefined
): ResolvedGantryStandings => {
  const widgets = dashboard?.widgets ?? [];
  const gantry = widgets.find((widget) => widget.id === 'gantry');
  const standings = sanitizeGantryStandings(gantry?.config?.standings);

  if (standings.source === 'builtin') return { status: 'builtin' };

  if (standings.source === 'overlay') {
    const widget = widgets.find(
      (candidate) => candidate.id === OVERLAY_STANDINGS_ID
    );
    return widget
      ? { status: 'ready', source: 'overlay', widget }
      : { status: 'builtin' };
  }

  if (!standings.widgetId) return { status: 'unlinked', source: 'gantry' };
  const widget = widgets.find(
    (candidate) =>
      candidate.id === standings.widgetId &&
      candidate.placement === 'gantry' &&
      widgetType(candidate) === 'standings'
  );
  return widget
    ? { status: 'ready', source: 'gantry', widget }
    : { status: 'removed', source: 'gantry' };
};
