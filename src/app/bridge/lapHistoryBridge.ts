import { ipcMain } from 'electron';
import type { LapHistorySnapshot } from '@irdashies/types';
import logger from '../logger';

export interface LapHistoryArchiveSource {
  /** SubSessionID of the event the sim is showing, '' when disconnected. */
  getCurrentSessionId: () => string;
  /** False while a replay file is loaded that irDashies did not record. */
  canReadArchive: () => boolean;
  load: (
    sessionId: string,
    sessionNum: number
  ) => Promise<LapHistorySnapshot | null>;
}

const MAX_SESSION_NUM = 999;

export const isValidSessionNum = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= 0 &&
  value <= MAX_SESSION_NUM;

/**
 * Serves archived lap history for one session of the current event. The
 * renderer only picks the session number; the event always comes from main.
 */
export const setupLapHistoryBridge = (source: LapHistoryArchiveSource) => {
  ipcMain.handle(
    'lapHistory:getArchived',
    async (_event, sessionNum: unknown) => {
      if (!isValidSessionNum(sessionNum)) {
        logger.warn('[LapHistory] Rejected invalid archived session number');
        return null;
      }
      const sessionId = source.getCurrentSessionId();
      if (!sessionId || !source.canReadArchive()) return null;
      try {
        return await source.load(sessionId, sessionNum);
      } catch (err) {
        logger.warn('[LapHistory] Failed to read archived lap history:', err);
        return null;
      }
    }
  );
};
