import { ipcMain } from 'electron';
import {
  listRadarPoleSides,
  setRadarPoleSide,
} from '../storage/radarPoleSides';

/** Lets the radar settings list and correct the pole sides it has learnt. */
export const setupRadarBridge = () => {
  ipcMain.handle('radar:getPoleSides', () => listRadarPoleSides());
  ipcMain.handle(
    'radar:setPoleSide',
    (_, track: string, kind: 'grid' | 'pace', side: 'left' | 'right' | null) =>
      setRadarPoleSide(track, kind, side)
  );
};
