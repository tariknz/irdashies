// tools/perf/run.ts loads this file with plain Node (type stripping), so keep
// it to type-only imports and erasable syntax: no enums, and no value imports
// without an extension or through @irdashies/* aliases.
import type { ActiveSimulator, DashboardLayout } from '@irdashies/types';

export const PERF_REPLAY_READY_LOG_MARKER =
  '[PerfRun] Ready for replay publisher';
export const PERF_VISIBILITY_LOG_PREFIX = '[PerfVisibility:JSON] ';
export const PERF_CAPTURE_ORIGIN_LOG_PREFIX = '[PerfRunOrigin:JSON] ';

export type PerfOverlayMode = 'full' | 'empty' | 'observer';

/**
 * Simulator a perf:run child should use. A publisher replay only starts once
 * the iRacing bridge logs PERF_REPLAY_READY_LOG_MARKER, so replay runs always
 * use iRacing, and a different choice from the caller is returned as
 * `overridden` so the tool can say so. An empty value is no choice.
 */
export function perfRunSimulator(
  callerSimulator: string | undefined,
  replay: boolean
): { simulator?: string; overridden?: string } {
  const iracing: ActiveSimulator = 'iracing';
  const chosen = callerSimulator?.trim() || undefined;
  if (!replay) return { simulator: chosen };
  return chosen && chosen !== iracing
    ? { simulator: iracing, overridden: chosen }
    : { simulator: iracing };
}

export interface PerfVisibilityPhase {
  visibility: 'visible' | 'hidden';
  durationSeconds: number;
}

export interface PerfRunConfig {
  enabled: boolean;
  overlayMode: PerfOverlayMode;
  widgetTypes: string[];
  scenario: string;
  durationSeconds: number;
  telemetryDelivery: 'on' | 'off';
  telemetryPayload: 'allowlisted' | 'raw';
  channelDelivery: 'on' | 'off';
  visibilityPhases: PerfVisibilityPhase[];
}

const PERF_OVERLAY_MODES = new Set<PerfOverlayMode>([
  'full',
  'empty',
  'observer',
]);

export const parsePerfVisibilityPhases = (
  value: string
): PerfVisibilityPhase[] =>
  value
    .split(',')
    .map((entry) => entry.trim().match(/^(visible|hidden):(\d+)$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => ({
      visibility: match[1] as PerfVisibilityPhase['visibility'],
      durationSeconds: Number(match[2]),
    }))
    .filter(
      (phase) => phase.durationSeconds >= 10 && phase.durationSeconds <= 86_400
    );

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
  const visibilityPhases = parsePerfVisibilityPhases(
    env.PERF_VISIBILITY_PHASES ?? ''
  );

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
    channelDelivery: env.PERF_CHANNEL_DELIVERY === 'off' ? 'off' : 'on',
    visibilityPhases,
  };
}

export function activePerfWidgetTypes(dashboard: DashboardLayout): string[] {
  return [
    ...new Set(
      dashboard.widgets
        .filter((widget) => widget.enabled)
        .map((widget) => widget.type ?? widget.id)
    ),
  ].sort();
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
