import { app } from 'electron';
import fsp from 'node:fs/promises';
import path from 'node:path';
import logger from '../logger';

const filePath = () =>
  path.join(app.getPath('userData'), 'radar-pole-side-report-hash.txt');

/** The stored text of the last acknowledged report's hash, if any. */
export const readRadarPoleSideReportHash = async (): Promise<
  string | undefined
> => {
  try {
    return (await fsp.readFile(filePath(), 'utf8')).trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      logger.warn('[RadarPoleSide] Could not read report hash');
    }
    return undefined;
  }
};

/** Awaited, not debounced: written at most once a minute, after a send. */
export const writeRadarPoleSideReportHash = async (
  hash: string
): Promise<void> => {
  try {
    await fsp.writeFile(filePath(), hash);
  } catch {
    logger.warn('[RadarPoleSide] Could not save report hash');
  }
};
