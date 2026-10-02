import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import logger from '../logger';

type FormationKind = 'grid' | 'pace';
type PoleSide = 'left' | 'right';
type TrackPoleSides = Partial<Record<FormationKind, PoleSide>>;

const filePath = path.join(app.getPath('userData'), 'radarPoleSides.json');

const readAll = (): Record<string, TrackPoleSides> => {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch {
    // Nothing learnt yet, or an unreadable file: start over.
    return {};
  }
};

/** Pole sides the radar has learnt from the spotter, by track. */
export const loadRadarPoleSides = (track: string): TrackPoleSides =>
  readAll()[track] ?? {};

export const saveRadarPoleSide = (
  track: string,
  kind: FormationKind,
  side: PoleSide
) => {
  const all = readAll();
  if (all[track]?.[kind] === side) return;
  all[track] = { ...all[track], [kind]: side };
  try {
    fs.writeFileSync(filePath, JSON.stringify(all, null, 2));
    logger.info(`[Radar] Learnt ${kind} pole side at ${track}: ${side}`);
  } catch (error) {
    logger.error('Failed to write radar pole sides:', error);
  }
};
