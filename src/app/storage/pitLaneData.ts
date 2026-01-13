import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';

export interface PitLaneTrackData {
  pitEntryPct: number | null;
  pitExitPct: number | null;
}

const dataPath = app.getPath('userData');
const filePath = path.join(dataPath, 'pitLaneData.json');

/**
 * Read all pit lane data from disk
 * @returns Record of track IDs to pit lane data
 */
export const readPitLaneData = (): Record<string, PitLaneTrackData> => {
  try {
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch {
    // File doesn't exist or is invalid, return empty object
    return {};
  }
};

/**
 * Write all pit lane data to disk
 * @param data Record of track IDs to pit lane data
 */
export const writePitLaneData = (data: Record<string, PitLaneTrackData>) => {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Failed to write pit lane data:', error);
  }
};

/**
 * Get pit lane data for a specific track
 * @param trackId Track ID from session
 * @returns Pit lane data or null if not found
 */
export const getPitLaneDataForTrack = (trackId: string): PitLaneTrackData | null => {
  const allData = readPitLaneData();
  return allData[trackId] || null;
};

/**
 * Update pit lane data for a specific track
 * @param trackId Track ID from session
 * @param data Pit lane data to save
 */
export const updatePitLaneDataForTrack = (trackId: string, data: Partial<PitLaneTrackData>) => {
  const allData = readPitLaneData();
  const existing = allData[trackId] || { pitEntryPct: null, pitExitPct: null };

  allData[trackId] = {
    ...existing,
    ...data,
  };

  writePitLaneData(allData);
};
