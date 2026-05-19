import { ipcMain } from 'electron';
import { personalBestDatabase } from '../storage/personalBestLapTimes';
import logger from '../logger';

export const setupPersonalBestLapTimesBridge = () => {

  const isTrackId = (value: unknown): value is string | number => typeof value === 'string' || typeof value === 'number';

  ipcMain.handle(
    'personalBest:get',
    (_, trackId: unknown, carName: unknown) => {
      if (!isTrackId(trackId) || typeof carName !== 'string') {
        throw new TypeError('Invalid payload for personalBest:get');
      }
      logger.debug(
        `[Main] Fetching personal best for track: ${trackId}, car: ${carName}`
      );
      return personalBestDatabase.getPersonalBest(trackId, carName);
    }
  );

  ipcMain.handle(
    'personalBest:set',
      (_, trackId: unknown, carName: unknown, time: unknown) => {
      if (
        !isTrackId(trackId) ||
        typeof carName !== 'string' ||
        typeof time !== 'number' ||
        !Number.isFinite(time)
      ) {
        throw new TypeError('Invalid payload for personalBest:set');
      }
      logger.info(
        `[Main] Saving personal best for track: ${trackId}, car: ${carName}, time: ${time.toFixed(3)}s`
      );
      try {
        personalBestDatabase.setPersonalBest(trackId, carName, time);        
      } catch (e) {
        logger.error('[Main] Failed to save personal best:', e);
        throw e;
      }
    }
  );  
};
