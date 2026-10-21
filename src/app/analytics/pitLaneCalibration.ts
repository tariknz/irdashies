import { app } from 'electron';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import logger from '../logger';
import type { PitLaneTrackData } from '@irdashies/types';

const MAX_TRACKS = 10_000;
const MAX_FILE_BYTES = 2 * 1024 * 1024;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isPosition = (value: unknown): value is number | null =>
  value === null ||
  (typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0 &&
    value <= 1);

/** Only the calibration schema may leave the installation, never raw file data. */
const calibrationFrom = (
  value: unknown
): Record<string, PitLaneTrackData> | undefined => {
  if (!isRecord(value)) return undefined;
  const entries = Object.entries(value);
  if (entries.length > MAX_TRACKS) return undefined;

  const tracks: Record<string, PitLaneTrackData> = {};
  for (const [trackId, calibration] of entries) {
    if (
      !/^[1-9]\d{0,9}$/.test(trackId) ||
      !isRecord(calibration) ||
      !isPosition(calibration.pitEntryPct) ||
      !isPosition(calibration.pitExitPct)
    ) {
      return undefined;
    }
    tracks[trackId] = {
      pitEntryPct: calibration.pitEntryPct,
      pitExitPct: calibration.pitExitPct,
    };
  }
  return tracks;
};

/** A bounded, asynchronous startup read; this never writes or repairs the file. */
export const readPitLaneCalibrationForAnalytics = async (): Promise<
  Record<string, PitLaneTrackData> | undefined
> => {
  try {
    const handle = await fs.open(
      path.join(app.getPath('userData'), 'pitLaneData.json'),
      'r'
    );
    try {
      // Read one byte beyond the cap to distinguish an oversized file from a
      // complete one, without trusting stat() while the file might be edited.
      const buffer = Buffer.alloc(MAX_FILE_BYTES + 1);
      let length = 0;
      while (length < buffer.length) {
        const { bytesRead } = await handle.read(
          buffer,
          length,
          buffer.length - length,
          null
        );
        if (bytesRead === 0) break;
        length += bytesRead;
      }
      if (length > MAX_FILE_BYTES) {
        logger.warn('[Analytics] Skipping oversized pit lane calibration');
        return undefined;
      }
      const parsed: unknown = JSON.parse(buffer.toString('utf8', 0, length));
      const tracks = calibrationFrom(parsed);
      if (!tracks) {
        logger.warn('[Analytics] Skipping invalid pit lane calibration');
      }
      return tracks;
    } finally {
      await handle.close();
    }
  } catch (error: unknown) {
    if (!isRecord(error) || error.code !== 'ENOENT') {
      // This warning can be forwarded to PostHog. Do not include paths, raw
      // JSON, or exception messages from the user-managed calibration file.
      logger.warn('[Analytics] Could not read pit lane calibration');
    }
    return undefined;
  }
};
