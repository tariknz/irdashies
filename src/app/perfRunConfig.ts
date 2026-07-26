import type { DashboardLayout } from '@irdashies/types';

export const PERF_REPLAY_READY_LOG_MARKER =
  '[PerfRun] Ready for replay publisher';

export type PerfOverlayMode = 'full' | 'empty' | 'observer';

export interface PerfRunConfig {
  enabled: boolean;
  overlayMode: PerfOverlayMode;
  widgetTypes: string[];
  scenario: string;
  durationSeconds: number;
  telemetryDelivery: 'on' | 'off';
  telemetryPayload: 'allowlisted' | 'raw';
}

const PERF_OVERLAY_MODES = new Set<PerfOverlayMode>([
  'full',
  'empty',
  'observer',
]);

export function getPerfRunConfig(
  env: NodeJS.ProcessEnv = process.env
): PerfRunConfig {
  const requestedMode = env.PERF_OVERLAY_MODE as PerfOverlayMode | undefined;
  const overlayMode =
    requestedMode && PERF_OVERLAY_MODES.has(requestedMode)
      ? requestedMode
      : 'full';
  const widgetTypes = (env.PERF_WIDGET_TYPES ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter((value) => /^[a-z0-9-]+$/i.test(value));
  const requestedDuration = Number(env.PERF_DURATION_SECONDS);
  const durationSeconds =
    Number.isFinite(requestedDuration) &&
    requestedDuration >= 10 &&
    requestedDuration <= 86_400
      ? requestedDuration
      : 0;

  return {
    enabled: env.PERF_METRICS === '1',
    overlayMode,
    widgetTypes,
    scenario:
      env.PERF_SCENARIO ??
      (widgetTypes.length > 0
        ? `widgets-${widgetTypes.join('-')}`
        : overlayMode),
    durationSeconds,
    telemetryDelivery: env.PERF_TELEMETRY_DELIVERY === 'off' ? 'off' : 'on',
    telemetryPayload:
      env.PERF_TELEMETRY_PAYLOAD === 'raw' ? 'raw' : 'allowlisted',
  };
}

export function createPerfDashboard(
  dashboard: DashboardLayout,
  config: PerfRunConfig
): DashboardLayout {
  if (!config.enabled || config.overlayMode === 'full') {
    if (config.widgetTypes.length === 0) return dashboard;

    const selectedTypes = new Set(config.widgetTypes);
    return {
      ...dashboard,
      widgets: dashboard.widgets.map((widget) => ({
        ...widget,
        enabled: selectedTypes.has(widget.type ?? widget.id),
      })),
    };
  }

  if (config.overlayMode === 'empty') {
    return {
      ...dashboard,
      widgets: dashboard.widgets.map((widget) => ({
        ...widget,
        enabled: false,
      })),
    };
  }

  return dashboard;
}
