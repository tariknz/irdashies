import { ipcMain } from 'electron';
import { getReferenceLap, saveReferenceLap } from '../storage/referenceLaps';
import type { ReferenceLap } from '@irdashies/types';
import logger from '../logger';

const FETCH_DEDUP_TTL_MS = 5000;

const recentFetches = new Map<string, number>();

const fetchKey = (seriesId: number, trackId: number, classId: number): string =>
  `${seriesId}_${trackId}_${classId}`;

const pruneExpiredFetches = (now: number): void => {
  for (const [key, timestamp] of recentFetches) {
    if (now - timestamp >= FETCH_DEDUP_TTL_MS) {
      recentFetches.delete(key);
    }
  }
};

export const setupReferenceLapsBridge = () => {
  ipcMain.handle(
    'reference:get',
    (_, seriesId: number, trackId: number, classId: number) => {
      const now = Date.now();
      pruneExpiredFetches(now);
      const key = fetchKey(seriesId, trackId, classId);
      const recent = recentFetches.get(key);

      if (recent === undefined) {
        recentFetches.set(key, now);
        logger.info(
          `[Main] Fetching reference lap for Series: ${seriesId}, Track: ${trackId}, Class: ${classId}`
        );
      } else {
        logger.debug(
          `[Main] Reference lap fetch dedup'd (${now - recent}ms after first invoke) for Series: ${seriesId}, Track: ${trackId}, Class: ${classId}`
        );
      }

      const lap = getReferenceLap(seriesId, trackId, classId);

      if (!lap) {
        logger.info(
          `[Main] No persisted reference lap for Series: ${seriesId}, Track: ${trackId}, Class: ${classId}`
        );
      }

      return lap;
    }
  );

  ipcMain.handle(
    'reference:save',
    (
      _,
      seriesId: number,
      trackId: number,
      classId: number,
      lapData: ReferenceLap
    ) => {
      logger.info(
        `[Main] Saving reference lap for Series: ${seriesId}, Track: ${trackId}, Class: ${classId}`
      );
      try {
        saveReferenceLap(seriesId, trackId, classId, lapData);
        return true;
      } catch (e) {
        logger.error('[Main] Failed to save reference lap:', e);
        throw e;
      }
    }
  );
};

export const __resetReferenceLapsBridgeForTests = (): void => {
  recentFetches.clear();
};
