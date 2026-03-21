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
import { ReplayPositionCommand } from '../irsdk/types/enums';

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
  cooldownSeconds: 5,
};

export const setupRaceControlBridge = () => {
  const isDev = !app.isPackaged;
  const detector = new IncidentDetector(defaultThresholds, isDev);
  let cachedTrackLengthM = 0;
  let currentSessionId = '';
  let retention: 'all' | 5 | 10 | 20 = 'all';

  const broadcast = (incident: Incident) => {
    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send('raceControl:incident', incident);
    });
  };

  detector.onIncident((incident) => {
    appendIncident(currentSessionId, incident);
    broadcast(incident);
  });

  const wireToTelemetryBridge = () => {
    const bridge = getCurrentBridge();
    if (!bridge) return;

    bridge.onSessionData((session) => {
      detector.updateSession(session);
      const trackLen = session?.WeekendInfo?.TrackLength;
      if (trackLen) cachedTrackLengthM = parseTrackLengthM(trackLen);
      const sessionId = session?.WeekendInfo?.SubSessionID?.toString() ?? '';
      if (sessionId && sessionId !== currentSessionId) {
        currentSessionId = sessionId;
        pruneOldSessions(retention);
      }
    });

    bridge.onTelemetry((telemetry) => {
      if (!cachedTrackLengthM) return;
      const snap = {
        sessionTime: telemetry.SessionTime?.value?.[0] ?? 0,
        sessionNum: telemetry.SessionNum?.value?.[0] ?? 0,
        replayFrameNum: telemetry.ReplayFrameNum?.value?.[0] ?? 0,
        carIdxLapDistPct: telemetry.CarIdxLapDistPct?.value ?? [],
        carIdxLap: telemetry.CarIdxLap?.value ?? [],
        carIdxTrackSurface: telemetry.CarIdxTrackSurface?.value ?? [],
        carIdxSessionFlags: telemetry.CarIdxSessionFlags?.value ?? [],
        carIdxOnPitRoad: telemetry.CarIdxOnPitRoad?.value ?? [],
      };
      detector.processTelemetry(snap, cachedTrackLengthM);
    });
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
    async (_event, incident: Incident, seconds: number) => {
      const bridge = getCurrentBridge();
      if (!bridge) return;
      const targetFrame = incident.replayFrameNum - Math.round(60 * seconds);
      await bridge.changeCameraNumber(incident.carIdx, 0, 0);
      await bridge.changeReplayPosition(
        ReplayPositionCommand.Begin,
        Math.max(0, targetFrame)
      );
    }
  );
};
