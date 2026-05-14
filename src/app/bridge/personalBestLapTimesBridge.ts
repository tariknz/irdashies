import { ipcMain } from 'electron';
import { personalBestDatabase } from '../storage/personalBestLapTimes';
import logger from '../logger';

export const setupPersonalBestLapTimesBridge = () => {
  ipcMain.handle(
    'personalBest:get',
    (_, trackId: string | number, carName: string) => {
      logger.debug(
        `[Main] Fetching personal best for track: ${trackId}, car: ${carName}`
      );
      return personalBestDatabase.getPersonalBest(trackId, carName);
    }
  );

  ipcMain.handle(
    'personalBest:set',
    (
      _,
      trackId: string | number,
      carName: string,
      time: number,
    ) => {
      logger.info(
        `[Main] Saving personal best for track: ${trackId}, car: ${carName}, time: ${time.toFixed(3)}s`
      );
      try {
        personalBestDatabase.setPersonalBest(trackId, carName, time);
        return true;
      } catch (e) {
        logger.error('[Main] Failed to save personal best:', e);
        throw e;
      }
    }
  );  
};
