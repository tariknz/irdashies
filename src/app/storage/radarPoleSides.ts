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

/** Everything learnt so far, for the radar's dev settings. */
export const listRadarPoleSides = (): Record<string, TrackPoleSides> =>
  readAll();

/** Set a side by hand, or forget it with null so it is learnt again. */
export const setRadarPoleSide = (
  track: string,
  kind: FormationKind,
  side: PoleSide | null
) => {
  const { [track]: current, ...others } = readAll();
  const sides: TrackPoleSides = Object.fromEntries(
    Object.entries({ ...current, [kind]: side }).filter(([, value]) => value)
  );
  const all = Object.keys(sides).length
    ? { ...others, [track]: sides }
    : others;
  try {
    fs.writeFileSync(filePath, JSON.stringify(all, null, 2));
    logger.info(`[Radar] ${kind} pole side at ${track} set to ${side}`);
  } catch (error) {
    logger.error('Failed to write radar pole sides:', error);
  }
};
