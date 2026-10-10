import { app } from 'electron';
import fsp from 'node:fs/promises';
import path from 'node:path';
import type { RadarPoleSides } from '@irdashies/types';
import logger from '../logger';

type FormationKind = 'grid' | 'pace';
type PoleSide = 'left' | 'right';
type TrackPoleSides = Partial<Record<FormationKind, PoleSide>>;

const filePath = path.join(app.getPath('userData'), 'radarPoleSides.json');

/** Same window as the other stores: bursts of learning collapse to one write. */
const WRITE_DEBOUNCE_MS = 250;

const KINDS: readonly FormationKind[] = ['grid', 'pace'];

export const isFormationKind = (value: unknown): value is FormationKind =>
  value === 'grid' || value === 'pace';

export const isPoleSide = (value: unknown): value is PoleSide =>
  value === 'left' || value === 'right';

/** Keeps only the well-formed sides of one track's entry. */
const sidesOf = (raw: unknown): TrackPoleSides => {
  const sides: TrackPoleSides = {};
  if (!raw || typeof raw !== 'object') return sides;
  for (const kind of KINDS) {
    const side = (raw as Record<string, unknown>)[kind];
    if (isPoleSide(side)) sides[kind] = side;
  }
  return sides;
};

/**
 * Learnt sides by WeekendInfo.TrackName, held in memory so the telemetry
 * callback never touches the disk. Empty until `loadRadarPoleSidesFile`
 * resolves.
 */
const cache = new Map<string, TrackPoleSides>();
let loading: Promise<void> | null = null;
let writeTimer: NodeJS.Timeout | null = null;
let writeInFlight: Promise<void> | null = null;

/**
 * Reads the file into the cache once; later calls share the same promise.
 * The SDK bridge awaits it before the radar processor can ask for a track.
 */
export const loadRadarPoleSidesFile = (): Promise<void> => {
  loading ??= fsp
    .readFile(filePath, 'utf8')
    .then((text) => {
      const parsed: unknown = JSON.parse(text);
      if (!parsed || typeof parsed !== 'object') return;
      for (const [track, raw] of Object.entries(parsed)) {
        const sides = sidesOf(raw);
        // Anything set since start-up is newer than the file.
        if (Object.keys(sides).length && !cache.has(track)) {
          cache.set(track, sides);
        }
      }
    })
    .catch((error: NodeJS.ErrnoException) => {
      // Nothing learnt yet is the usual case, not a warning.
      if (error?.code !== 'ENOENT') {
        logger.warn('[Radar] Could not read radarPoleSides.json:', error);
      }
    });
  return loading;
};

const flushAsync = async (): Promise<void> => {
  try {
    await fsp.writeFile(
      filePath,
      JSON.stringify(Object.fromEntries(cache), null, 2)
    );
  } catch (error) {
    logger.error('Failed to write radar pole sides:', error);
  }
};

const enqueueFlush = (): void => {
  const tracked = (writeInFlight ?? Promise.resolve())
    .then(flushAsync)
    .finally(() => {
      if (writeInFlight === tracked) writeInFlight = null;
    });
  writeInFlight = tracked;
};

const scheduleWrite = (): void => {
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    writeTimer = null;
    enqueueFlush();
  }, WRITE_DEBOUNCE_MS);
};

/** Pole sides the radar has learnt from the spotter, by track. */
export const loadRadarPoleSides = (track: string): TrackPoleSides => ({
  ...cache.get(track),
});

export const saveRadarPoleSide = (
  track: string,
  kind: FormationKind,
  side: PoleSide
) => {
  if (cache.get(track)?.[kind] === side) return;
  cache.set(track, { ...cache.get(track), [kind]: side });
  logger.info(`[Radar] Learnt ${kind} pole side at ${track}: ${side}`);
  scheduleWrite();
};

/** Everything learnt so far, for the radar's dev settings. */
export const listRadarPoleSides = (): RadarPoleSides =>
  Object.fromEntries([...cache].map(([track, sides]) => [track, { ...sides }]));

/** Set a side by hand, or forget it with null so it is learnt again. */
export const setRadarPoleSide = (
  track: string,
  kind: FormationKind,
  side: PoleSide | null
) => {
  const sides = sidesOf({ ...cache.get(track), [kind]: side });
  if (Object.keys(sides).length) cache.set(track, sides);
  else cache.delete(track);
  logger.info(`[Radar] ${kind} pole side at ${track} set to ${side}`);
  scheduleWrite();
};

/** Drains a pending write; the before-quit coordinator awaits this. */
export const flushRadarPoleSidesOnShutdown = async (): Promise<void> => {
  if (writeTimer) {
    clearTimeout(writeTimer);
    writeTimer = null;
    enqueueFlush();
  }
  while (writeInFlight) await writeInFlight;
};

/** Testing helper: reset module-level state so each spec starts clean. */
export const __resetForTests = (): void => {
  cache.clear();
  loading = null;
  if (writeTimer) clearTimeout(writeTimer);
  writeTimer = null;
  writeInFlight = null;
};
