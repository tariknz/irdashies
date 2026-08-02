import { ipcMain, BrowserWindow, app } from 'electron';
import { getCurrentBridge, onBridgeChanged } from './iracingSdk/setup';
import { IncidentDetector } from '../services/incidentDetector';
import {
  loadIncidents,
  appendIncident,
  clearIncidents,
  pruneOldSessions,
} from '../storage/incidentStorage';
import type { Incident, IncidentThresholds } from '../../types/raceControl';
import logger from '../logger';

/** Parse "5.12 km" → 5120 (metres) */
function parseTrackLengthM(str: string): number {
  return parseFloat(str) * 1000;
}

const defaultThresholds: IncidentThresholds = {
  slowSpeedThreshold: 15,
  slowFrameThreshold: 10,
  suddenStopFromSpeed: 80,
  suddenStopToSpeed: 20,
  suddenStopFrames: 3,
  offTrackDebounce: 3,
  pitEntryDebounce: 3,
  cooldownSeconds: 5,
};

export const setupRaceControlBridge = () => {
  const isDev = !app.isPackaged;
  const detector = new IncidentDetector(defaultThresholds, isDev);
  let cachedTrackLengthM = 0;
  let currentSessionId = '';
  let currentSessionNum: number | null = null;
  let lastSession: Parameters<typeof detector.updateSession>[0] | null = null;
  let retention: 'all' | 5 | 10 | 20 = 'all';

  const broadcast = (incident: Incident) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('raceControl:incident', incident);
    });
  };

  detector.onIncident((incident) => {
    logger.info(
      `[RaceControl] incident emitted type=${incident.type} car=${incident.carIdx} (${incident.driverName} #${incident.carNumber}) lap=${incident.lapNum} lapDistPct=${incident.lapDistPct.toFixed(3)} sessionTime=${incident.sessionTime.toFixed(2)} id=${incident.id}`
    );
    broadcast(incident);
    appendIncident(currentSessionId, incident).catch((err) =>
      logger.error('[RaceControl] Failed to persist incident:', err)
    );
  });

  let unsubscribeSession: (() => void) | undefined;
  let unsubscribeTelemetry: (() => void) | undefined;

  const wireToTelemetryBridge = () => {
    // Clean up previous subscriptions before re-wiring
    unsubscribeSession?.();
    unsubscribeTelemetry?.();

    const bridge = getCurrentBridge();
    if (!bridge) return;

    unsubscribeSession =
      bridge.onSessionData((session) => {
        lastSession = session;
        detector.updateSession(session, currentSessionNum ?? undefined);
        const trackLen = session?.WeekendInfo?.TrackLength;
        if (trackLen) {
          const parsed = parseTrackLengthM(trackLen);
          if (Number.isFinite(parsed) && parsed > 0) {
            cachedTrackLengthM = parsed;
          } else {
            logger.warn(
              '[RaceControl] Could not parse track length:',
              trackLen
            );
          }
        }
        const sessionId = session?.WeekendInfo?.SubSessionID?.toString() ?? '';
        if (sessionId && sessionId !== currentSessionId) {
          logger.info(
            `[RaceControl] session changed: ${currentSessionId || '(none)'} -> ${sessionId}`
          );
          currentSessionId = sessionId;
          pruneOldSessions(retention);
        }
      }) ?? undefined;

    unsubscribeTelemetry =
      bridge.onTelemetry((telemetry) => {
        if (!cachedTrackLengthM) return;
        const snap = {
          sessionTime: telemetry.SessionTime?.value?.[0] ?? 0,
          sessionNum: telemetry.SessionNum?.value?.[0] ?? 0,
          sessionState: telemetry.SessionState?.value?.[0] ?? 0,
          replayFrameNum: telemetry.ReplayFrameNum?.value?.[0] ?? 0,
          carIdxLapDistPct: telemetry.CarIdxLapDistPct?.value ?? [],
          carIdxLap: telemetry.CarIdxLap?.value ?? [],
          carIdxTrackSurface: telemetry.CarIdxTrackSurface?.value ?? [],
          carIdxSessionFlags: telemetry.CarIdxSessionFlags?.value ?? [],
          carIdxOnPitRoad: telemetry.CarIdxOnPitRoad?.value ?? [],
        };

        // Detect session-phase change (e.g. Practice → Qualify → Race within
        // the same SubSessionID). When it changes, immediately re-run
        // updateSession so detector resets cleanly before next tick.
        if (snap.sessionNum !== currentSessionNum) {
          const prev = currentSessionNum;
          currentSessionNum = snap.sessionNum;
          logger.info(
            `[RaceControl] telemetry SessionNum changed: ${prev ?? '(none)'} -> ${snap.sessionNum}`
          );
          if (lastSession) {
            detector.updateSession(lastSession, currentSessionNum);
          }
        }

        detector.processTelemetry(snap, cachedTrackLengthM);
      }) ?? undefined;
  };

  wireToTelemetryBridge();
  onBridgeChanged(wireToTelemetryBridge);

  ipcMain.handle(
    'raceControl:updateThresholds',
    (_event, thresholds: IncidentThresholds) => {
      detector.updateThresholds(thresholds);
    }
  );

  ipcMain.handle(
    'raceControl:updateRetention',
    (_event, r: 'all' | 5 | 10 | 20) => {
      retention = r;
    }
  );

  ipcMain.handle('raceControl:getIncidents', () => {
    return loadIncidents(currentSessionId);
  });

  ipcMain.handle('raceControl:clearIncidents', () => {
    clearIncidents(currentSessionId);
  });

  ipcMain.handle(
    'raceControl:replayIncident',
    (_event, incident: Incident, seconds: number) => {
      const bridge = getCurrentBridge();
      if (!bridge) return;
      const targetTimeMs = Math.max(
        0,
        Math.round((incident.sessionTime - seconds) * 1000)
      );
      logger.info(
        `[RaceControl] replayIncident car=${incident.carIdx} (${incident.driverName} #${incident.carNumber}) type=${incident.type} sessionTime=${incident.sessionTime.toFixed(2)} sessionNum=${incident.sessionNum} offset=-${seconds}s targetTimeMs=${targetTimeMs}`
      );
      bridge.changeCameraNumber(incident.carNumber, 0, 0);
      bridge.triggerReplaySessionSearch(incident.sessionNum, targetTimeMs);
    }
  );
};
