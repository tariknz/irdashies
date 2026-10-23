import * as fsp from 'node:fs/promises';
import path from 'node:path';
import type { RacePlanStop } from '@irdashies/types';
import logger from '../logger';

/**
 * What the team car actually did in a race, per `SubSessionID`, so a restart
 * mid-race resumes the stint history. Cap: the 5 most recently saved
 * sessions, each with at most 64 stints and 64 stops.
 */
const FILE_NAME = 'race-plan-history.json';
const FILE_VERSION = 1;
export const MAX_RACE_PLAN_HISTORY_SESSIONS = 5;
export const MAX_RACE_PLAN_HISTORY_ENTRIES = 64;
const MAX_FILE_BYTES = 2_000_000;
const WRITE_DEBOUNCE_MS = 250;

export interface RacePlanHistoryStint {
  driverId: number | null;
  startLap: number;
  startSec: number;
  endLap: number | null;
  endSec: number | null;
  /** Index of the plan stint this one stands for. */
  planIndex: number;
  /** Began with fuel added, or at the race start. */
  fueled: boolean;
}

export interface RacePlanHistoryRecord {
  subSessionId: number;
  /** The race session within the event. */
  sessionNum: number;
  /** SessionTime when the race went green. */
  greenSessionTime: number;
  /** Epoch milliseconds of the green flag on this PC's clock. */
  raceStartMs: number;
  finished: boolean;
  stints: RacePlanHistoryStint[];
  stops: RacePlanStop[];
}

interface StoredRecord extends RacePlanHistoryRecord {
  savedAt: number;
}

interface StoredFile {
  version: number;
  sessions: StoredRecord[];
}

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const isLap = (value: unknown): value is number =>
  typeof value === 'number' && Number.isInteger(value) && value >= 0;

const isId = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0;

const nullable = <T>(
  value: unknown,
  check: (candidate: unknown) => candidate is T
): T | null | undefined =>
  value === null ? null : check(value) ? value : undefined;

const sanitizeStint = (value: unknown): RacePlanHistoryStint | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const driverId = nullable(raw.driverId, isId);
  const endLap = nullable(raw.endLap, isLap);
  const endSec = nullable(raw.endSec, isFiniteNumber);
  if (
    driverId === undefined ||
    endLap === undefined ||
    endSec === undefined ||
    !isLap(raw.startLap) ||
    !isFiniteNumber(raw.startSec) ||
    !isLap(raw.planIndex) ||
    typeof raw.fueled !== 'boolean'
  )
    return null;
  return {
    driverId,
    startLap: raw.startLap,
    startSec: raw.startSec,
    endLap,
    endSec,
    planIndex: raw.planIndex,
    fueled: raw.fueled,
  };
};

const sanitizeStop = (value: unknown): RacePlanStop | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const fuelAdded = nullable(raw.fuelAdded, isFiniteNumber);
  if (
    fuelAdded === undefined ||
    !isLap(raw.lap) ||
    !isFiniteNumber(raw.elapsedSec) ||
    !isFiniteNumber(raw.durationSec) ||
    typeof raw.fuelAssumed !== 'boolean' ||
    typeof raw.driverChanged !== 'boolean' ||
    typeof raw.compoundChanged !== 'boolean' ||
    typeof raw.unplanned !== 'boolean'
  )
    return null;
  return {
    lap: raw.lap,
    elapsedSec: raw.elapsedSec,
    durationSec: raw.durationSec,
    fuelAdded,
    fuelAssumed: raw.fuelAssumed,
    driverChanged: raw.driverChanged,
    compoundChanged: raw.compoundChanged,
    unplanned: raw.unplanned,
  };
};

const sanitizeList = <T>(
  value: unknown,
  sanitizeEntry: (entry: unknown) => T | null
): T[] | null => {
  if (!Array.isArray(value)) return null;
  const entries: T[] = [];
  for (const entry of value.slice(-MAX_RACE_PLAN_HISTORY_ENTRIES)) {
    const sanitized = sanitizeEntry(entry);
    if (!sanitized) return null;
    entries.push(sanitized);
  }
  return entries;
};

const sanitizeRecord = (value: unknown): StoredRecord | null => {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Record<string, unknown>;
  const stints = sanitizeList(raw.stints, sanitizeStint);
  const stops = sanitizeList(raw.stops, sanitizeStop);
  if (
    !stints ||
    !stops ||
    !isId(raw.subSessionId) ||
    !isLap(raw.sessionNum) ||
    !isFiniteNumber(raw.greenSessionTime) ||
    !isFiniteNumber(raw.raceStartMs) ||
    !isFiniteNumber(raw.savedAt) ||
    typeof raw.finished !== 'boolean'
  )
    return null;
  return {
    subSessionId: raw.subSessionId,
    sessionNum: raw.sessionNum,
    greenSessionTime: raw.greenSessionTime,
    raceStartMs: raw.raceStartMs,
    finished: raw.finished,
    stints,
    stops,
    savedAt: raw.savedAt,
  };
};

/** Valid records, newest first, without duplicates; null for a bad file. */
export function sanitizeRacePlanHistory(value: unknown): StoredRecord[] | null {
  if (!value || typeof value !== 'object') return null;
  const raw = value as Partial<Record<keyof StoredFile, unknown>>;
  if (raw.version !== FILE_VERSION || !Array.isArray(raw.sessions)) return null;
  const records = raw.sessions
    .map(sanitizeRecord)
    .filter((record): record is StoredRecord => record !== null)
    .sort((a, b) => b.savedAt - a.savedAt);
  const seen = new Set<number>();
  return records
    .filter((record) => {
      if (seen.has(record.subSessionId)) return false;
      seen.add(record.subSessionId);
      return true;
    })
    .slice(0, MAX_RACE_PLAN_HISTORY_SESSIONS);
}

const copyRecord = (record: RacePlanHistoryRecord): RacePlanHistoryRecord => ({
  subSessionId: record.subSessionId,
  sessionNum: record.sessionNum,
  greenSessionTime: record.greenSessionTime,
  raceStartMs: record.raceStartMs,
  finished: record.finished,
  stints: record.stints
    .slice(-MAX_RACE_PLAN_HISTORY_ENTRIES)
    .map((stint) => ({ ...stint })),
  stops: record.stops
    .slice(-MAX_RACE_PLAN_HISTORY_ENTRIES)
    .map((stop) => ({ ...stop })),
});

export interface RacePlanHistoryStore {
  /** Reads the file once. Resolves with no history on any error. */
  load(): Promise<void>;
  /** The saved history for a sub-session, from memory. */
  get(subSessionId: number): RacePlanHistoryRecord | null;
  /** Replaces the sub-session's history. Writes are debounced. */
  save(record: RacePlanHistoryRecord): void;
  /** Writes any pending change now. */
  flush(): Promise<void>;
}

export function createRacePlanHistoryStore(
  filePath: string,
  now: () => number = Date.now
): RacePlanHistoryStore {
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
        const stored = sanitizeRacePlanHistory(
          JSON.parse(await fsp.readFile(filePath, 'utf8'))
        );
        if (!stored) {
          logger.warn('[RacePlan] Invalid race plan history file', fileName);
          return;
        }
        // Sessions saved while the read was in flight stay newest.
        const saved = new Set(records.map((record) => record.subSessionId));
        records = [
          ...records,
          ...stored.filter((record) => !saved.has(record.subSessionId)),
        ].slice(0, MAX_RACE_PLAN_HISTORY_SESSIONS);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          logger.warn(
            '[RacePlan] Failed to read race plan history',
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
        '[RacePlan] Failed to save race plan history',
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
    get(subSessionId) {
      const record = records.find(
        (candidate) => candidate.subSessionId === subSessionId
      );
      return record ? copyRecord(record) : null;
    },
    save(record) {
      if (!isId(record.subSessionId)) return;
      const next: StoredRecord = { ...copyRecord(record), savedAt: now() };
      records = [
        next,
        ...records.filter(
          (candidate) => candidate.subSessionId !== record.subSessionId
        ),
      ].slice(0, MAX_RACE_PLAN_HISTORY_SESSIONS);
      dirty = true;
      clearTimeout(timer);
      timer = setTimeout(() => void flush(), WRITE_DEBOUNCE_MS);
    },
    flush,
  };
}

let defaultStore: RacePlanHistoryStore | undefined;

/** The app's store in `userData`. */
export function getRacePlanHistoryStore(): RacePlanHistoryStore {
  if (!defaultStore) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { app } = require('electron') as typeof import('electron');
    defaultStore = createRacePlanHistoryStore(
      path.join(app.getPath('userData'), FILE_NAME)
    );
  }
  return defaultStore;
}

export const flushRacePlanHistoryOnShutdown = (): Promise<void> =>
  defaultStore?.flush() ?? Promise.resolve();
