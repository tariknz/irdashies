import { ipcMain } from 'electron';
import { getReferenceLap, saveReferenceLap } from '../storage/referenceLaps';
import type { ReferenceLap } from 'src/types/referenceLaps';
import log from '../logger';

export const setupReferenceLapsBridge = () => {
  ipcMain.handle(
    'reference:get',
    (_, seriesId: number, trackId: number, classId: number) => {
      log.info(
        `[Main] Fetching reference lap for Series: ${seriesId}, Track: ${trackId}, Class: ${classId}`
      );
      return getReferenceLap(seriesId, trackId, classId);
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
      log.info(
        `[Main] Saving reference lap for Series: ${seriesId}, Track: ${trackId}, Class: ${classId}`
      );
      try {
        saveReferenceLap(seriesId, trackId, classId, lapData);
        return true;
      } catch (e) {
        log.error('[Main] Failed to save reference lap:', e);
        throw e;
      }
    }
  );
};
