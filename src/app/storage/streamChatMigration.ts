import type { DashboardLayout, DashboardWidget } from '@irdashies/types';

const LEGACY_ID = 'twitchchat';
const NEW_ID = 'streamchat';

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const finiteNumber = (value: unknown): number | undefined =>
  typeof value === 'number' && Number.isFinite(value) ? value : undefined;

const withoutUndefined = (entries: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(entries).filter(([, value]) => value !== undefined)
  );

/**
 * Maps the flat Twitch Chat config onto the Stream Chat shape. Only values of
 * the right type are carried over; whatever is left out is filled from the
 * manifest defaults by the caller, so a damaged config cannot leak into the
 * new one.
 */
const migrateLegacyConfig = (legacy: unknown): Record<string, unknown> => {
  if (!isRecord(legacy)) return {};
  const background = isRecord(legacy.background) ? legacy.background : {};
  const autoHide = isRecord(legacy.autoHide) ? legacy.autoHide : {};

  return {
    display: withoutUndefined({
      fontSize: finiteNumber(legacy.fontSize),
      background: withoutUndefined({
        opacity: finiteNumber(background.opacity),
      }),
      autoHide: withoutUndefined({
        enabled:
          typeof autoHide.enabled === 'boolean' ? autoHide.enabled : undefined,
        intervalSeconds: finiteNumber(autoHide.intervalSeconds),
      }),
    }),
    twitch: withoutUndefined({
      channel: typeof legacy.channel === 'string' ? legacy.channel : undefined,
    }),
  };
};

const migrateWidget = (widget: DashboardWidget): DashboardWidget => ({
  ...widget,
  id: widget.id === LEGACY_ID ? NEW_ID : widget.id,
  ...(widget.type === LEGACY_ID ? { type: NEW_ID } : {}),
  config: migrateLegacyConfig(widget.config),
});

/**
 * Twitch Chat became Stream Chat (Twitch plus YouTube), which renamed the
 * widget id and regrouped its settings. A dashboard saved by an earlier build
 * keeps its position, size and enabled state; the settings are mapped across.
 * When both exist (a dashboard edited by hand) the Stream Chat one wins.
 */
export const migrateLegacyStreamChat = (
  dashboard: DashboardLayout
): DashboardLayout => {
  if (!dashboard.widgets.some((w) => w.id === LEGACY_ID)) return dashboard;

  const hasNew = dashboard.widgets.some((w) => w.id === NEW_ID);
  const widgets = hasNew
    ? dashboard.widgets.filter((w) => w.id !== LEGACY_ID)
    : dashboard.widgets.map((w) => (w.id === LEGACY_ID ? migrateWidget(w) : w));

  return { ...dashboard, widgets };
};
