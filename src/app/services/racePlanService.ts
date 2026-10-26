import type {
  RacePlanChooseResult,
  RacePlanConfigPatch,
  RacePlanFetchError,
  RacePlanFetchStatus,
  RacePlanListResult,
  RacePlanning,
  RacePlanState,
  RacePlanStrategy,
} from '@irdashies/types';
import type {
  RacePlanStore,
  RacePlanStoredState,
} from '../storage/racePlanStore';
import { isRefreshMinutes } from '../storage/racePlanStore';
import type { IracePlanClient } from './iracePlanClient';
import {
  normalizeRacePlanList,
  normalizeRacePlanning,
  rawPlanningOf,
} from './racePlanNormalize';
import logger from '../logger';

/** OS-backed encryption for the API key (Electron safeStorage in the app). */
export interface ApiKeyCrypto {
  isAvailable(): boolean;
  /** Returns base64 ciphertext. */
  encrypt(plain: string): string;
  decrypt(base64: string): string;
}

const API_KEY_MAX_LENGTH = 512;

/** Throws unless `value` is a bounded printable-ASCII key; returns it trimmed. */
export function parseApiKey(value: unknown): string {
  if (typeof value !== 'string') throw new Error('Invalid API key');
  const key = value.trim();
  if (
    key.length === 0 ||
    key.length > API_KEY_MAX_LENGTH ||
    !/^[\x21-\x7E]+$/.test(key)
  )
    throw new Error('Invalid API key');
  return key;
}

const isIdOrNull = (value: unknown): value is number | null =>
  value === null ||
  (typeof value === 'number' && Number.isSafeInteger(value) && value > 0);

/** Throws unless `value` is a planning id or null. */
export function parsePlanningId(value: unknown): number | null {
  if (!isIdOrNull(value)) throw new Error('Invalid planning id');
  return value;
}

/**
 * Throws unless `value` is a partial config with valid values. The planning
 * is changed through `choosePlanning`, so `planningId` is ignored here.
 */
export function parseConfigPatch(value: unknown): RacePlanConfigPatch {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Invalid race plan config');
  const raw = value as Record<string, unknown>;
  const patch: RacePlanConfigPatch = {};
  if ('strategyId' in raw) {
    if (!isIdOrNull(raw.strategyId)) throw new Error('Invalid strategy id');
    patch.strategyId = raw.strategyId;
  }
  if ('refreshMinutes' in raw) {
    if (!isRefreshMinutes(raw.refreshMinutes))
      throw new Error('Invalid refresh interval');
    patch.refreshMinutes = raw.refreshMinutes;
  }
  return patch;
}

/** The planning and the strategy in use. */
export interface ActiveRacePlan {
  planning: RacePlanning;
  strategy: RacePlanStrategy;
}

export interface RacePlanService {
  ready: Promise<void>;
  getState(): Promise<RacePlanState>;
  /** Loads the planning first; the config only changes if it loads. */
  choosePlanning(planningId: unknown): Promise<RacePlanChooseResult>;
  setConfig(patch: unknown): Promise<RacePlanState>;
  setApiKey(apiKey: unknown): Promise<RacePlanState>;
  clearApiKey(): Promise<RacePlanState>;
  listPlannings(): Promise<RacePlanListResult>;
  refreshNow(): Promise<RacePlanState>;
  /** The last good planning, for main-process consumers. */
  getPlanning(): RacePlanning | null;
  /** The last good planning with its configured (or first) strategy. */
  getActivePlan(): ActiveRacePlan | null;
  onChange(listener: (state: RacePlanState) => void): () => void;
  dispose(): void;
}

interface LoadedPlanning {
  planning: RacePlanning;
  raw: Record<string, unknown>;
}

type FetchedPlanning =
  ({ ok: true } & LoadedPlanning) | { ok: false; error: RacePlanFetchError };

export function createRacePlanService(options: {
  store: RacePlanStore;
  client: IracePlanClient;
  crypto: ApiKeyCrypto;
  now?: () => number;
}): RacePlanService {
  const { store, client, crypto } = options;
  const now = options.now ?? Date.now;
  let stored: RacePlanStoredState;
  let planning: RacePlanning | null = null;
  let status: RacePlanFetchStatus = 'idle';
  let timer: NodeJS.Timeout | undefined;
  let inFlight: Promise<void> | null = null;
  /** Bumped whenever the planning changes, so stale answers are dropped. */
  let generation = 0;
  let disposed = false;
  const listeners = new Set<(state: RacePlanState) => void>();

  const apiKey = (): string | null => {
    if (!stored.encryptedApiKey) return null;
    try {
      return crypto.decrypt(stored.encryptedApiKey);
    } catch {
      logger.warn('[RacePlan] Could not decrypt the saved API key');
      return null;
    }
  };

  const effectiveStrategyId = (): number | null => {
    if (!planning) return null;
    const chosen = planning.strategies.find(
      (s) => s.id === stored.config.strategyId
    );
    return (chosen ?? planning.strategies[0])?.id ?? null;
  };

  const snapshot = (): RacePlanState => ({
    config: { ...stored.config },
    hasApiKey: stored.encryptedApiKey !== null,
    canStoreApiKey: crypto.isAvailable(),
    status,
    fetchedAt: planning ? (stored.cache?.fetchedAt ?? null) : null,
    planning,
    strategyId: effectiveStrategyId(),
  });

  const emit = () => {
    if (disposed) return;
    const state = snapshot();
    for (const listener of listeners) listener(state);
  };

  const commit = () => {
    store.save(stored);
    emit();
  };

  const fetchPlanning = async (
    key: string,
    planningId: number
  ): Promise<FetchedPlanning> => {
    const result = await client.getPlanning(key, planningId);
    if (!result.ok) {
      logger.warn('[RacePlan] Planning fetch failed:', result.error);
      return { ok: false, error: result.error };
    }
    const next = normalizeRacePlanning(result.body);
    const raw = rawPlanningOf(result.body);
    if (!next || !raw || next.id !== planningId) {
      logger.warn('[RacePlan] Planning response failed validation');
      return { ok: false, error: 'invalid-response' };
    }
    return { ok: true, planning: next, raw };
  };

  const accept = (loaded: LoadedPlanning) => {
    planning = loaded.planning;
    status = 'ok';
    stored = { ...stored, cache: { planning: loaded.raw, fetchedAt: now() } };
    logger.info(
      `[RacePlan] Planning loaded: ${loaded.planning.strategies.length} strategies, ${loaded.planning.drivers.length} drivers`
    );
  };

  const refresh = (): Promise<void> => {
    if (inFlight) return inFlight;
    const key = apiKey();
    const planningId = stored.config.planningId;
    if (!key || planningId === null) return Promise.resolve();
    const started = generation;
    inFlight = (async () => {
      const fetched = await fetchPlanning(key, planningId);
      // The planning changed while the request was out: drop the answer.
      if (disposed || generation !== started) return;
      if (!fetched.ok) {
        status = fetched.error;
        emit();
        return;
      }
      accept(fetched);
      commit();
    })().finally(() => {
      inFlight = null;
    });
    return inFlight;
  };

  const schedule = () => {
    clearInterval(timer);
    timer = undefined;
    if (
      disposed ||
      !stored.encryptedApiKey ||
      stored.config.planningId === null
    )
      return;
    timer = setInterval(
      () => void refresh(),
      stored.config.refreshMinutes * 60_000
    );
  };

  const ready = store.load().then((loaded) => {
    stored = loaded;
    const cached = loaded.cache
      ? normalizeRacePlanning(loaded.cache.planning)
      : null;
    planning = cached && cached.id === loaded.config.planningId ? cached : null;
    if (!planning && loaded.cache) stored = { ...stored, cache: null };
    schedule();
    void refresh();
  });

  return {
    ready,
    async getState() {
      await ready;
      return snapshot();
    },
    async choosePlanning(raw) {
      const planningId = parsePlanningId(raw);
      await ready;
      if (planningId !== null && planningId === stored.config.planningId) {
        await refresh();
        return { status: 'ok', state: snapshot() };
      }
      let loaded: LoadedPlanning | null = null;
      if (planningId !== null) {
        const key = apiKey();
        if (!key) return { status: 'unauthorized' };
        const started = generation;
        const fetched = await fetchPlanning(key, planningId);
        if (!fetched.ok) return { status: fetched.error };
        // Another choice won while this one was loading.
        if (disposed || generation !== started)
          return { status: 'ok', state: snapshot() };
        loaded = fetched;
      }
      generation += 1;
      stored = {
        ...stored,
        config: { ...stored.config, planningId, strategyId: null },
        cache: null,
      };
      planning = null;
      status = 'idle';
      if (loaded) accept(loaded);
      schedule();
      commit();
      return { status: 'ok', state: snapshot() };
    },
    async setConfig(raw) {
      const patch = parseConfigPatch(raw);
      await ready;
      stored = { ...stored, config: { ...stored.config, ...patch } };
      schedule();
      commit();
      return snapshot();
    },
    async setApiKey(raw) {
      const key = parseApiKey(raw);
      await ready;
      if (!crypto.isAvailable())
        throw new Error('Secure storage is not available on this PC');
      stored = { ...stored, encryptedApiKey: crypto.encrypt(key) };
      status = 'idle';
      schedule();
      commit();
      await refresh();
      return snapshot();
    },
    async clearApiKey() {
      await ready;
      stored = { ...stored, encryptedApiKey: null };
      status = 'idle';
      schedule();
      commit();
      return snapshot();
    },
    async listPlannings() {
      await ready;
      const key = apiKey();
      if (!key) return { status: 'unauthorized' };
      const result = await client.listPlannings(key);
      if (!result.ok) return { status: result.error };
      const plannings = normalizeRacePlanList(result.body);
      if (!plannings) return { status: 'invalid-response' };
      return { status: 'ok', plannings };
    },
    async refreshNow() {
      await ready;
      await refresh();
      return snapshot();
    },
    getPlanning: () => planning,
    getActivePlan() {
      const id = effectiveStrategyId();
      const strategy = planning?.strategies.find((s) => s.id === id);
      return planning && strategy ? { planning, strategy } : null;
    },
    onChange(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispose() {
      disposed = true;
      clearInterval(timer);
      timer = undefined;
      listeners.clear();
    },
  };
}
