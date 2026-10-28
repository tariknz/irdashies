import * as fsp from 'node:fs/promises';
import path from 'node:path';
import {
  RACE_PLAN_REFRESH_MINUTES,
  type RacePlanConfig,
} from '@irdashies/types';
import logger from '../logger';

/** The raw planning is re-checked by the service on load, like a response. */
export interface RacePlanCache {
  planning: Record<string, unknown>;
  fetchedAt: number;
}

export interface RacePlanStoredState {
  config: RacePlanConfig;
  /** Base64 of the OS-encrypted key (Electron safeStorage). */
  encryptedApiKey: string | null;
  cache: RacePlanCache | null;
}

const MAX_FILE_BYTES = 5_000_000;
const MAX_ENCRYPTED_KEY_LENGTH = 4_096;
const WRITE_DEBOUNCE_MS = 250;

export const defaultRacePlanConfig = (): RacePlanConfig => ({
  planningId: null,
  strategyId: null,
  refreshMinutes: RACE_PLAN_REFRESH_MINUTES.default,
});

export const defaultRacePlanState = (): RacePlanStoredState => ({
  config: defaultRacePlanConfig(),
  encryptedApiKey: null,
  cache: null,
});

const positiveIntOrNull = (value: unknown): number | null =>
  typeof value === 'number' && Number.isSafeInteger(value) && value > 0
    ? value
    : null;

export const isRefreshMinutes = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isInteger(value) &&
  value >= RACE_PLAN_REFRESH_MINUTES.min &&
  value <= RACE_PLAN_REFRESH_MINUTES.max;

export function sanitizeRacePlanState(value: unknown): RacePlanStoredState {
  const state = defaultRacePlanState();
  if (!value || typeof value !== 'object') return state;
  const raw = value as Partial<Record<keyof RacePlanStoredState, unknown>>;
  const config = (raw.config ?? {}) as Partial<Record<string, unknown>>;
  state.config = {
    planningId: positiveIntOrNull(config.planningId),
    strategyId: positiveIntOrNull(config.strategyId),
    refreshMinutes: isRefreshMinutes(config.refreshMinutes)
      ? config.refreshMinutes
      : RACE_PLAN_REFRESH_MINUTES.default,
  };
  if (
    typeof raw.encryptedApiKey === 'string' &&
    raw.encryptedApiKey.length > 0 &&
    raw.encryptedApiKey.length <= MAX_ENCRYPTED_KEY_LENGTH &&
    /^[A-Za-z0-9+/=]+$/.test(raw.encryptedApiKey)
  ) {
    state.encryptedApiKey = raw.encryptedApiKey;
  }
  const cache = raw.cache as Partial<RacePlanCache> | null | undefined;
  if (
    cache &&
    typeof cache === 'object' &&
    cache.planning &&
    typeof cache.planning === 'object' &&
    !Array.isArray(cache.planning) &&
    typeof cache.fetchedAt === 'number' &&
    Number.isFinite(cache.fetchedAt)
  ) {
    state.cache = { planning: cache.planning, fetchedAt: cache.fetchedAt };
  }
  return state;
}

export interface RacePlanStore {
  /** Reads the file once. Resolves with defaults on any error. */
  load(): Promise<RacePlanStoredState>;
  /** Replaces the state. Writes are debounced. */
  save(state: RacePlanStoredState): void;
  /** Writes any pending change now. */
  flush(): Promise<void>;
}

export function createRacePlanStore(filePath: string): RacePlanStore {
  const fileName = path.basename(filePath);
  let state = defaultRacePlanState();
  let loaded: Promise<RacePlanStoredState> | undefined;
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
        state = sanitizeRacePlanState(
          JSON.parse(await fsp.readFile(filePath, 'utf8'))
        );
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
          logger.warn(
            '[RacePlan] Failed to read race plan state',
            fileName,
            describeError(error)
          );
        }
      }
      return state;
    })());

  const write = async () => {
    if (!dirty) return;
    dirty = false;
    const temp = `${filePath}.${process.pid}.tmp`;
    try {
      await fsp.mkdir(path.dirname(filePath), { recursive: true });
      await fsp.writeFile(temp, JSON.stringify(state), 'utf8');
      await fsp.rename(temp, filePath);
    } catch (error) {
      logger.warn(
        '[RacePlan] Failed to save race plan state',
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
    save(next) {
      state = next;
      dirty = true;
      clearTimeout(timer);
      timer = setTimeout(() => void flush(), WRITE_DEBOUNCE_MS);
    },
    flush,
  };
}
