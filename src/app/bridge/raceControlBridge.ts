import { ipcMain } from 'electron';
import type { DashboardLayout, Session, Telemetry } from '@irdashies/types';
import { getCurrentBridge, onBridgeChanged } from './iracingSdk/setup';
import {
  loadIncidents,
  clearIncidents,
  pruneOldSessions,
} from '../storage/incidentStorage';
import { onDashboardUpdated } from '../storage/dashboardEvents';
import {
  INCIDENT_THRESHOLD_BOUNDS,
  type IncidentThresholds,
} from '../../types/raceControl';
import logger from '../logger';

/** Small interface over IncidentRuntime — keeps this bridge decoupled from
 * processor internals while still reaching updateThresholds/session state. */
export interface IncidentRuntimeHandle {
  onSession: (session: Session) => void;
  onFrame: (frame: Telemetry) => void;
  updateEnabled: (enabled: boolean) => void;
  updateThresholds: (thresholds: IncidentThresholds) => void;
  getCurrentSessionId: () => string;
  onSessionIdChanged: (cb: (sessionId: string) => void) => () => void;
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const thresholdKeys: (keyof IncidentThresholds)[] = [
  'slowSpeedThreshold',
  'slowDurationSeconds',
  'impactDecelKmhPerSec',
  'impactMinSpeed',
  'offTrackDurationSeconds',
  'pitEntryDurationSeconds',
  'cooldownSeconds',
];

const isValidThresholds = (value: unknown): value is IncidentThresholds => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return thresholdKeys.every((key) => {
    const threshold = candidate[key];
    const bounds = INCIDENT_THRESHOLD_BOUNDS[key];
    return (
      isFiniteNumber(threshold) &&
      threshold >= bounds.min &&
      threshold <= bounds.max
    );
  });
};

const isValidRetention = (value: unknown): value is 'all' | 5 | 10 | 20 =>
  value === 'all' || value === 5 || value === 10 || value === 20;

const isValidCarNumber = (value: unknown): value is string =>
  typeof value === 'string' && value.length > 0 && value.length <= 8;

interface ReplayIncidentPayload {
  sessionTime: number;
  sessionNum: number;
  carNumber: string;
  carIdx?: number;
  driverName?: string;
  type?: string;
}

const isValidReplayIncident = (
  value: unknown
): value is ReplayIncidentPayload => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return (
    isFiniteNumber(candidate.sessionTime) &&
    isFiniteNumber(candidate.sessionNum) &&
    isValidCarNumber(candidate.carNumber)
  );
};

const isValidReplaySeconds = (value: unknown): value is number =>
  isFiniteNumber(value) && value >= 0 && value <= 300;

export const setupRaceControlBridge = (
  runtime: IncidentRuntimeHandle,
  initialDashboard?: DashboardLayout
) => {
  let retention: 'all' | 5 | 10 | 20 = 'all';

  const applyRetention = (value: 'all' | 5 | 10 | 20) => {
    retention = value;
    void pruneOldSessions(value).catch((err) =>
      logger.error('[RaceControl] Failed to prune old sessions:', err)
    );
  };

  runtime.onSessionIdChanged((sessionId) => {
    if (!sessionId) return;
    void pruneOldSessions(retention).catch((err) =>
      logger.error('[RaceControl] Failed to prune old sessions:', err)
    );
  });

  /**
   * The detector and the retention window live in the main process, but their
   * settings are persisted in the dashboard. Without this the renderer's
   * `updateThresholds`/`updateRetention` calls are the only way values ever
   * reach main — so after a restart, or a profile switch, detection silently
   * runs on built-in defaults while Settings shows the saved numbers.
   */
  const applyDashboard = (dashboard: DashboardLayout | undefined) => {
    const widget = dashboard?.widgets.find((w) => w.id === 'gantry');
    runtime.updateEnabled(widget?.enabled ?? false);
    const config = widget?.config;
    if (!config) return;
    if (isValidThresholds(config)) {
      runtime.updateThresholds(config);
    } else {
      logger.warn(
        '[RaceControl] Saved Gantry thresholds are invalid; keeping defaults'
      );
    }
    if (isValidRetention(config.sessionRetention)) {
      applyRetention(config.sessionRetention);
    }
  };

  applyDashboard(initialDashboard);
  onDashboardUpdated(applyDashboard);

  let unsubscribeSession: (() => void) | undefined;
  let unsubscribeTelemetry: (() => void) | undefined;

  const wireToTelemetryBridge = () => {
    // Clean up previous subscriptions before re-wiring
    unsubscribeSession?.();
    unsubscribeTelemetry?.();

    const bridge = getCurrentBridge();
    if (!bridge) return;

    unsubscribeSession =
      bridge.onSessionData((session) => runtime.onSession(session)) ??
      undefined;
    unsubscribeTelemetry =
      bridge.onTelemetry((telemetry) => runtime.onFrame(telemetry)) ??
      undefined;
  };

  wireToTelemetryBridge();
  onBridgeChanged(wireToTelemetryBridge);

  ipcMain.handle(
    'raceControl:updateThresholds',
    (_event, thresholds: unknown) => {
      if (!isValidThresholds(thresholds)) {
        logger.warn('[RaceControl] Rejected invalid thresholds payload');
        return;
      }
      runtime.updateThresholds(thresholds);
    }
  );

  ipcMain.handle('raceControl:updateRetention', (_event, value: unknown) => {
    if (!isValidRetention(value)) {
      logger.warn('[RaceControl] Rejected invalid retention value:', value);
      return;
    }
    applyRetention(value);
  });

  ipcMain.handle('raceControl:getIncidents', () => {
    const sessionId = runtime.getCurrentSessionId();
    return sessionId
      ? loadIncidents(sessionId).then((incidents) => ({
          sessionId,
          incidents,
        }))
      : { sessionId: '', incidents: [] };
  });

  ipcMain.handle('raceControl:clearIncidents', () => {
    // Returned so the IPC reply waits for the delete; clearIncidents became
    // async, and without this the renderer could reload before it completed.
    const sessionId = runtime.getCurrentSessionId();
    return sessionId ? clearIncidents(sessionId) : undefined;
  });

  ipcMain.handle('raceControl:focusDriver', (_event, carNumber: unknown) => {
    if (!isValidCarNumber(carNumber)) {
      logger.warn(
        '[RaceControl] Rejected invalid focusDriver carNumber:',
        carNumber
      );
      return;
    }
    const bridge = getCurrentBridge();
    if (!bridge) return;
    logger.info(`[RaceControl] focusDriver #${carNumber}`);
    bridge.changeCameraNumber(carNumber, 0, 0);
  });

  ipcMain.handle(
    'raceControl:replayIncident',
    (_event, incident: unknown, seconds: unknown) => {
      if (!isValidReplayIncident(incident)) {
        logger.warn(
          '[RaceControl] Rejected invalid replayIncident incident payload'
        );
        return;
      }
      if (!isValidReplaySeconds(seconds)) {
        logger.warn(
          '[RaceControl] Rejected invalid replayIncident seconds:',
          seconds
        );
        return;
      }
      const bridge = getCurrentBridge();
      if (!bridge) return;
      const targetTimeMs = Math.max(
        0,
        Math.round((incident.sessionTime - seconds) * 1000)
      );
      logger.info(
        `[RaceControl] replayIncident car=${incident.carIdx ?? 'unknown'} (${incident.driverName ?? 'unknown'} #${incident.carNumber}) type=${incident.type ?? 'unknown'} sessionTime=${incident.sessionTime.toFixed(2)} sessionNum=${incident.sessionNum} offset=-${seconds}s targetTimeMs=${targetTimeMs}`
      );
      bridge.changeCameraNumber(incident.carNumber, 0, 0);
      bridge.triggerReplaySessionSearch(incident.sessionNum, targetTimeMs);
    }
  );
};
