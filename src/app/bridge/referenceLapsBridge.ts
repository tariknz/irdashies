import { ipcMain } from 'electron';
import { getReferenceLap, saveReferenceLap } from '../storage/referenceLaps';
import type { ReferenceLap } from 'src/types/referenceLaps';

export const setupReferenceLapsBridge = () => {
  ipcMain.handle(
    'reference:get',
    (_, seriesId: number, trackId: number, classId: number) => {
      console.log(
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
      console.log(
        `[Main] Saving reference lap for Series: ${seriesId}, Track: ${trackId}, Class: ${classId}`
      );
      try {
        saveReferenceLap(seriesId, trackId, classId, lapData);
        return true;
      } catch (e) {
        console.error('[Main] Failed to save reference lap:', e);
        throw e;
      }
    }
  );

  /*
  ipcMain.handle('reference:delete', (_, seriesId: number, trackId: number, classId: number) => {
    console.log(`[Main] Deleting reference lap for Series: ${seriesId}, Track: ${trackId}, Class: ${classId}`);
    return deleteReferenceLap(seriesId, trackId, classId);
  });
  */
};
