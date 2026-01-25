import { ipcMain } from 'electron';
import { getPitLaneDataForTrack, updatePitLaneDataForTrack } from '../storage/pitLaneData';
import type { PitLaneTrackData } from '@irdashies/types';

export const setupPitLaneBridge = () => {
  // Get pit lane data for a specific track
  ipcMain.handle('pitLane:getData', async (_event, trackId: string): Promise<PitLaneTrackData | null> => {
    return getPitLaneDataForTrack(trackId);
  });

  // Update pit lane data for a specific track
  ipcMain.handle('pitLane:updateData', async (_event, trackId: string, data: Partial<PitLaneTrackData>): Promise<void> => {
    updatePitLaneDataForTrack(trackId, data);
  });
};
