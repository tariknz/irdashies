import * as fsp from 'node:fs/promises';
import path from 'node:path';
import type { PitStopRecord } from '@irdashies/types';
import { PIT_STOP_CAPACITY } from '@irdashies/types';
import logger from '../logger';

/**
 * Finished pit stops per session, so a restart mid-race keeps the stops made
 * before it. Cap: the 5 most recently saved sessions, each with at most
 * PIT_STOP_CAPACITY stops.
 */
const FILE_NAME = 'pit-stop-history.json';
const FILE_VERSION = 1;
export const MAX_PIT_STOP_HISTORY_SESSIONS = 5;
const MAX_FILE_BYTES = 10_000_000;
// A busy field stops every few seconds; the file is rewritten whole.
const WRITE_DEBOUNCE_MS = 2000;

export interface PitStopHistoryKey {
  subSessionId: number;
  sessionNum: number;
}

interface StoredRecord extends PitStopHistoryKey {
  savedAt: number;
  stops: PitStopRecord[];
}

interface StoredFile {
  version: number;
  sessions: StoredRecord[];
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isInt = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value);

const isId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

const sanitizeStop = (value: unknown): PitStopRecord | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const nullableNumber = (field: unknown) =>
    field === null || isFiniteNumber(field);
  const nullableId = (field: unknown) => field === null || isId(field);
  if (
    !isId(raw.id) ||
    !isInt(raw.carIdx) ||
    (raw.kind !== 'pit' && raw.kind !== 'tow') ||
    !isInt(raw.lap) ||
    !isFiniteNumber(raw.entryTime) ||
    !isFiniteNumber(raw.exitTime) ||
    !nullableNumber(raw.stallTime) ||
    !isFiniteNumber(raw.stallSeconds) ||
    !nullableId(raw.driverIdIn) ||
    !nullableId(raw.driverIdOut) ||
    typeof raw.driverNameIn !== 'string' ||
    typeof raw.driverNameOut !== 'string' ||
    !isInt(raw.classPositionIn) ||
    !isInt(raw.classPositionOut) ||
    !isInt(raw.compoundIn) ||
    !isInt(raw.compoundOut) ||
    !isInt(raw.fastRepairs)
  )
    return null;
  return {
    id: raw.id,
    carIdx: raw.carIdx,
    kind: raw.kind,
    lap: raw.lap,
    entryTime: raw.entryTime,
    exitTime: raw.exitTime,
    stallTime: raw.stallTime as number | null,
    stallSeconds: raw.stallSeconds,
    stallEnteredAt: null,
    driverIdIn: raw.driverIdIn as number | null,
    driverNameIn: raw.driverNameIn,
    driverIdOut: raw.driverIdOut as number | null,
    driverNameOut: raw.driverNameOut,
    classPositionIn: raw.classPositionIn,
    classPositionOut: raw.classPositionOut,
    compoundIn: raw.compoundIn,
    compoundOut: raw.compoundOut,
    fastRepairs: raw.fastRepairs,
  };
};

const sanitizeRecord = (value: unknown): StoredRecord | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  if (
    !isId(raw.subSessionId) ||
    !isInt(raw.sessionNum) ||
    raw.sessionNum < 0 ||
    !isFiniteNumber(raw.savedAt) ||
    !Array.isArray(raw.stops)
  )
    return null;
  const stops: PitStopRecord[] = [];
  for (const entry of raw.stops.slice(-PIT_STOP_CAPACITY)) {
    const stop = sanitizeStop(entry);
    if (!stop) return null;
    stops.push(stop);
  }
  return {
    subSessionId: raw.subSessionId,
    sessionNum: raw.sessionNum,
    savedAt: raw.savedAt,
    stops,
  };
};

const sameKey = (a: PitStopHistoryKey, b: PitStopHistoryKey) =>
  a.subSessionId === b.subSessionId && a.sessionNum === b.sessionNum;

/** Valid records, newest first, without duplicates; null for a bad file. */
export function sanitizePitStopHistory(value: unknown): StoredRecord[] | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<Record<keyof StoredFile, unknown>>;
  if (raw.version !== FILE_VERSION || !Array.isArray(raw.sessions)) return null;
  const records = raw.sessions
    .map(sanitizeRecord)
    .filter((record): record is StoredRecord => record !== null)
    .sort((a, b) => b.savedAt - a.savedAt);
  return records
    .filter(
      (record, index) =>
        records.findIndex((other) => sameKey(other, record)) === index
    )
    .slice(0, MAX_PIT_STOP_HISTORY_SESSIONS);
}

export interface PitStopHistoryStore {
  /** Reads the file once. Resolves with no history on any error. */
  load(): Promise<void>;
  /** The finished stops saved for a session, from memory. */
  get(key: PitStopHistoryKey): PitStopRecord[] | null;
  /** Replaces the session's finished stops. Writes are debounced. */
  save(key: PitStopHistoryKey, stops: readonly PitStopRecord[]): void;
  /** Writes any pending change now. */
  flush(): Promise<void>;
}

export function createPitStopHistoryStore(
  filePath: string,
  now: () => number = Date.now
): PitStopHistoryStore {
  const fileName = path.basename(filePath);
  let records: StoredRecord[] = [];
  let loaded: Promise<void> | undefined;
  let timer: NodeJS.Timeout | undefined;
  let dirty = false;
  let writes = Promise.resolve();

  const describeError = (error: unknown) =>
    error instanceof Error
      ? error.message.replaceAll(filePath, fileName)
      : String(error);

  const load = () =>
    (loaded ??= (async () => {
      try {
        if ((await fsp.stat(filePath)).size > MAX_FILE_BYTES)
          throw new Error('File too large');
        const stored = sanitizePitStopHistory(
          JSON.parse(await fsp.readFile(filePath, 'utf8'))
        );
        if (!stored) {
          logger.warn('[PitStops] Invalid pit stop history file', fileName);
          return;
        }
        // Sessions saved while the read was in flight stay newest.
        records = [
          ...records,
          ...stored.filter(
            (record) => !records.some((saved) => sameKey(saved, record))
          ),
        ].slice(0, MAX_PIT_STOP_HISTORY_SESSIONS);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          logger.warn(
            '[PitStops] Failed to read pit stop history',
            fileName,
            describeError(error)
          );
        }
      }
    })());

  const write = async () => {
    await load();
    if (!dirty) return;
    dirty = false;
    const temp = `${filePath}.${process.pid}.tmp`;
    const payload: StoredFile = { version: FILE_VERSION, sessions: records };
    try {
      await fsp.mkdir(path.dirname(filePath), { recursive: true });
      await fsp.writeFile(temp, JSON.stringify(payload), 'utf8');
      await fsp.rename(temp, filePath);
    } catch (error) {
      logger.warn(
        '[PitStops] Failed to save pit stop history',
        fileName,
        describeError(error)
      );
      await fsp.unlink(temp).catch(() => undefined);
    }
  };

  const flush = () => {
    clearTimeout(timer);
    timer = undefined;
    writes = writes.then(write);
    return writes;
  };

  return {
    load,
    get(key) {
      const record = records.find((candidate) => sameKey(candidate, key));
      return record ? record.stops.map((stop) => ({ ...stop })) : null;
    },
    save(key, stops) {
      if (!isId(key.subSessionId) || !isInt(key.sessionNum)) return;
      const finished = stops
        .filter((stop) => stop.exitTime !== null)
        .slice(-PIT_STOP_CAPACITY)
        .map((stop) => ({ ...stop, stallEnteredAt: null }));
      if (finished.length === 0) return;
      const next: StoredRecord = {
        subSessionId: key.subSessionId,
        sessionNum: key.sessionNum,
        savedAt: now(),
        stops: finished,
      };
      records = [
        next,
        ...records.filter((candidate) => !sameKey(candidate, key)),
      ].slice(0, MAX_PIT_STOP_HISTORY_SESSIONS);
      dirty = true;
      clearTimeout(timer);
      timer = setTimeout(() => void flush(), WRITE_DEBOUNCE_MS);
    },
    flush,
  };
}

let defaultStore: PitStopHistoryStore | undefined;

/** The app's store in `userData`. */
export function getPitStopHistoryStore(): PitStopHistoryStore {
  if (!defaultStore) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron') as typeof import('electron');
    defaultStore = createPitStopHistoryStore(
      path.join(app.getPath('userData'), FILE_NAME)
    );
  }
  return defaultStore;
}

export const flushPitStopHistoryOnShutdown = (): Promise<void> =>
  defaultStore?.flush() ?? Promise.resolve();
