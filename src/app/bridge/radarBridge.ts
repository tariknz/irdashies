import { ipcMain } from 'electron';
import {
  isFormationKind,
  isPoleSide,
  listRadarPoleSides,
  setRadarPoleSide,
} from '../storage/radarPoleSides';
import logger from '../logger';

/** Longer than any WeekendInfo.TrackName; anything past it is not a track. */
const MAX_TRACK_NAME = 200;

/** Lets the radar settings list and correct the pole sides it has learnt. */
export const setupRadarBridge = () => {
  ipcMain.handle('radar:getPoleSides', () => listRadarPoleSides());
  ipcMain.handle(
    'radar:setPoleSide',
    (_, track: unknown, kind: unknown, side: unknown) => {
      if (
        typeof track !== 'string' ||
        !track.trim() ||
        track.length > MAX_TRACK_NAME ||
        !isFormationKind(kind) ||
        (side !== null && !isPoleSide(side))
      ) {
        logger.warn('[Radar] Rejected pole side update', { kind, side });
        return;
      }
      setRadarPoleSide(track, kind, side);
    }
  );
};
