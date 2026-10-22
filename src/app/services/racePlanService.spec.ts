import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('../logger', () => ({ default: { info: vi.fn(), warn: vi.fn() } }));
import type { RacePlanState } from '@irdashies/types';
import {
  defaultRacePlanState,
  type RacePlanStore,
  type RacePlanStoredState,
} from '../storage/racePlanStore';
import type { IracePlanClient, IracePlanResponse } from './iracePlanClient';
import {
  createRacePlanService,
  parseApiKey,
  parseConfigPatch,
  type ApiKeyCrypto,
} from './racePlanService';
import {
  FIXTURE_PLANNING_ID,
  FIXTURE_STRATEGY_ID,
  rawPlanningFixture,
} from './racePlanFixture';

const KEY = 'test-key-123';

const memoryStore = (initial: RacePlanStoredState = defaultRacePlanState()) => {
  let state = initial;
  return {
    load: vi.fn(async () => state),
    save: vi.fn((next: RacePlanStoredState) => {
      state = next;
    }),
    flush: vi.fn(async () => undefined),
    current: () => state,
  } satisfies RacePlanStore & { current: () => RacePlanStoredState };
};

const fakeCrypto = (available = true): ApiKeyCrypto => ({
  isAvailable: () => available,
  encrypt: (plain) => Buffer.from(`enc:${plain}`).toString('base64'),
  decrypt: (b64) => Buffer.from(b64, 'base64').toString().replace(/^enc:/, ''),
});

const okPlanning = (): IracePlanResponse => ({
  ok: true,
  body: rawPlanningFixture(),
});

const OTHER_ID = 555;

const planningWithId = (id: number): IracePlanResponse => {
  const body = rawPlanningFixture();
  body.planning.id = id;
  return { ok: true, body };
};

const stubClient = (
  getPlanning: IracePlanClient['getPlanning'] = async () => okPlanning(),
  listPlannings: IracePlanClient['listPlannings'] = async () => ({
    ok: true,
    body: {
      plannings: [{ id: FIXTURE_PLANNING_ID, session: { name: 'Test 24' } }],
      meta: { count: 1, total: 1 },
    },
  })
) => ({
  getPlanning: vi.fn(getPlanning),
  listPlannings: vi.fn(listPlannings),
});

const configured = (): RacePlanStoredState => ({
  ...defaultRacePlanState(),
  config: {
    planningId: FIXTURE_PLANNING_ID,
    strategyId: null,
    refreshMinutes: 5,
  },
  encryptedApiKey: fakeCrypto().encrypt(KEY),
});

const services: { dispose(): void }[] = [];
const make = (options: Parameters<typeof createRacePlanService>[0]) => {
  const service = createRacePlanService(options);
  services.push(service);
  return service;
};

afterEach(() => {
  services.splice(0).forEach((s) => s.dispose());
  vi.useRealTimers();
});

describe('parseConfigPatch', () => {
  it('accepts valid values and ignores the planning and unknown keys', () => {
    expect(
      parseConfigPatch({
        planningId: 3,
        strategyId: null,
        refreshMinutes: 30,
        x: 1,
      })
    ).toEqual({ strategyId: null, refreshMinutes: 30 });
  });

  it.each([
    ['a non-object', 'x'],
    ['an array', []],
    ['a negative id', { strategyId: -1 }],
    ['a fractional id', { strategyId: 1.5 }],
    ['a string id', { strategyId: '3' }],
    ['an interval below 1', { refreshMinutes: 0 }],
    ['an interval above 30', { refreshMinutes: 31 }],
  ])('rejects %s', (_label, value) => {
    expect(() => parseConfigPatch(value)).toThrow();
  });
});

describe('parseApiKey', () => {
  it('trims a printable key', () => {
    expect(parseApiKey('  abc-123  ')).toBe('abc-123');
  });

  it.each([
    ['a number', 42],
    ['an empty string', '   '],
    ['a key with spaces inside', 'abc 123'],
    ['non-ASCII text', 'clé'],
    ['a very long key', 'x'.repeat(513)],
  ])('rejects %s', (_label, value) => {
    expect(() => parseApiKey(value)).toThrow();
  });
});

describe('racePlanService', () => {
  it('starts empty with no key and never exposes the key', async () => {
    const service = make({
      store: memoryStore(configured()),
      client: stubClient(async () => new Promise(() => undefined)),
      crypto: fakeCrypto(),
    });
    const state = await service.getState();
    expect(state.hasApiKey).toBe(true);
    expect(JSON.stringify(state)).not.toContain(KEY);
    expect(JSON.stringify(state)).not.toContain(configured().encryptedApiKey);
  });

  it('saves the key encrypted and loads the planning', async () => {
    const store = memoryStore({
      ...defaultRacePlanState(),
      config: {
        planningId: FIXTURE_PLANNING_ID,
        strategyId: null,
        refreshMinutes: 5,
      },
    });
    const client = stubClient();
    const service = make({ store, client, crypto: fakeCrypto() });
    const state = await service.setApiKey(KEY);
    expect(store.current().encryptedApiKey).not.toBe(KEY);
    expect(client.getPlanning).toHaveBeenCalledWith(KEY, FIXTURE_PLANNING_ID);
    expect(state.status).toBe('ok');
    expect(state.planning?.id).toBe(FIXTURE_PLANNING_ID);
    expect(state.strategyId).toBe(FIXTURE_STRATEGY_ID);
    expect(store.current().cache?.planning).toMatchObject({
      id: FIXTURE_PLANNING_ID,
    });
  });

  it('gives main-process consumers the planning with its strategy', async () => {
    const service = make({
      store: memoryStore(configured()),
      client: stubClient(),
      crypto: fakeCrypto(),
    });
    expect(service.getActivePlan()).toBeNull();
    await service.refreshNow();
    const active = service.getActivePlan();
    expect(active?.planning.id).toBe(FIXTURE_PLANNING_ID);
    expect(active?.strategy.id).toBe(FIXTURE_STRATEGY_ID);

    await service.setConfig({ strategyId: 999 });
    expect(service.getActivePlan()?.strategy.id).toBe(FIXTURE_STRATEGY_ID);
  });

  it('refuses to save the key when the OS cannot encrypt it', async () => {
    const store = memoryStore();
    const service = make({
      store,
      client: stubClient(),
      crypto: fakeCrypto(false),
    });
    await expect(service.setApiKey(KEY)).rejects.toThrow();
    expect(store.save).not.toHaveBeenCalled();
    expect((await service.getState()).canStoreApiKey).toBe(false);
  });

  it('keeps the last good plan when a refresh fails', async () => {
    let next: IracePlanResponse = okPlanning();
    const service = make({
      store: memoryStore(configured()),
      client: stubClient(async () => next),
      crypto: fakeCrypto(),
      now: () => 5_000,
    });
    await service.refreshNow();
    next = { ok: false, error: 'network' };
    const state = await service.refreshNow();
    expect(state.status).toBe('network');
    expect(state.planning?.id).toBe(FIXTURE_PLANNING_ID);
    expect(state.fetchedAt).toBe(5_000);
  });

  it.each(['unauthorized', 'not-found', 'invalid-response'] as const)(
    'reports %s',
    async (error) => {
      const service = make({
        store: memoryStore(configured()),
        client: stubClient(async () => ({ ok: false, error })),
        crypto: fakeCrypto(),
      });
      expect((await service.refreshNow()).status).toBe(error);
    }
  );

  it('rejects a response for a different planning', async () => {
    const body = rawPlanningFixture();
    body.planning.id = 1234;
    const service = make({
      store: memoryStore(configured()),
      client: stubClient(async () => ({ ok: true, body })),
      crypto: fakeCrypto(),
    });
    const state = await service.refreshNow();
    expect(state.status).toBe('invalid-response');
    expect(state.planning).toBeNull();
  });

  it('serves the cached plan before the network answers', async () => {
    const service = make({
      store: memoryStore({
        ...configured(),
        cache: { planning: rawPlanningFixture().planning, fetchedAt: 1_000 },
      }),
      client: stubClient(async () => new Promise(() => undefined)),
      crypto: fakeCrypto(),
    });
    const state = await service.getState();
    expect(state.planning?.id).toBe(FIXTURE_PLANNING_ID);
    expect(state.fetchedAt).toBe(1_000);
  });

  it('drops a cached plan for a different planning', async () => {
    const service = make({
      store: memoryStore({
        ...configured(),
        config: { planningId: 1, strategyId: null, refreshMinutes: 5 },
        cache: { planning: rawPlanningFixture().planning, fetchedAt: 1_000 },
      }),
      client: stubClient(async () => new Promise(() => undefined)),
      crypto: fakeCrypto(),
    });
    expect((await service.getState()).planning).toBeNull();
  });

  it('switches to a planning only once it has loaded', async () => {
    const store = memoryStore(configured());
    const client = stubClient(async (_key, id) =>
      id === OTHER_ID ? planningWithId(OTHER_ID) : okPlanning()
    );
    const service = make({ store, client, crypto: fakeCrypto() });
    await service.refreshNow();
    await service.setConfig({ strategyId: FIXTURE_STRATEGY_ID });
    const result = await service.choosePlanning(OTHER_ID);
    expect(result.status).toBe('ok');
    const state = await service.getState();
    expect(state.config).toMatchObject({
      planningId: OTHER_ID,
      strategyId: null,
    });
    expect(state.planning?.id).toBe(OTHER_ID);
    expect(state.status).toBe('ok');
    expect(store.current().config.planningId).toBe(OTHER_ID);
  });

  it.each([
    'not-found',
    'network',
    'invalid-response',
    'unauthorized',
  ] as const)(
    'keeps the current planning when the new one is %s',
    async (error) => {
      const store = memoryStore(configured());
      const client = stubClient(async (_key, id) =>
        id === OTHER_ID ? { ok: false, error } : okPlanning()
      );
      const service = make({ store, client, crypto: fakeCrypto() });
      await service.refreshNow();
      expect(await service.choosePlanning(OTHER_ID)).toEqual({ status: error });
      const state = await service.getState();
      expect(state.config.planningId).toBe(FIXTURE_PLANNING_ID);
      expect(state.planning?.id).toBe(FIXTURE_PLANNING_ID);
      expect(state.status).toBe('ok');
      expect(store.current().config.planningId).toBe(FIXTURE_PLANNING_ID);
    }
  );

  it('stops following a planning when none is chosen', async () => {
    const service = make({
      store: memoryStore(configured()),
      client: stubClient(),
      crypto: fakeCrypto(),
    });
    await service.refreshNow();
    const result = await service.choosePlanning(null);
    expect(result.status).toBe('ok');
    const state = await service.getState();
    expect(state.config.planningId).toBeNull();
    expect(state.planning).toBeNull();
  });

  it('reports unauthorized without a key and does not fetch', async () => {
    const client = stubClient();
    const service = make({
      store: memoryStore(),
      client,
      crypto: fakeCrypto(),
    });
    expect(await service.choosePlanning(OTHER_ID)).toEqual({
      status: 'unauthorized',
    });
    expect(client.getPlanning).not.toHaveBeenCalled();
  });

  it('drops a refresh answer for the previous planning', async () => {
    let answerOld: (value: IracePlanResponse) => void = () => undefined;
    const client = stubClient((_key, id) =>
      id === OTHER_ID
        ? Promise.resolve(planningWithId(OTHER_ID))
        : new Promise<IracePlanResponse>((resolve) => (answerOld = resolve))
    );
    const service = make({
      store: memoryStore(configured()),
      client,
      crypto: fakeCrypto(),
    });
    await service.ready;
    await service.choosePlanning(OTHER_ID);
    answerOld(okPlanning());
    await new Promise((resolve) => setTimeout(resolve, 0));
    const state = await service.getState();
    expect(state.planning?.id).toBe(OTHER_ID);
    expect(state.config.planningId).toBe(OTHER_ID);
  });

  it('rejects a planning id that is not a positive whole number', async () => {
    const service = make({
      store: memoryStore(configured()),
      client: stubClient(),
      crypto: fakeCrypto(),
    });
    await expect(service.choosePlanning('9001')).rejects.toThrow();
    await expect(service.choosePlanning(-1)).rejects.toThrow();
  });

  it('refreshes on the configured interval', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const client = stubClient();
    const service = make({
      store: memoryStore(configured()),
      client,
      crypto: fakeCrypto(),
    });
    await service.ready;
    await vi.waitFor(() => expect(client.getPlanning).toHaveBeenCalledTimes(1));
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(client.getPlanning).toHaveBeenCalledTimes(2);
    await service.setConfig({ refreshMinutes: 10 });
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(client.getPlanning).toHaveBeenCalledTimes(2);
    await vi.advanceTimersByTimeAsync(5 * 60_000);
    expect(client.getPlanning).toHaveBeenCalledTimes(3);
  });

  it('stops refreshing once the key is cleared', async () => {
    vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval'] });
    const client = stubClient();
    const service = make({
      store: memoryStore(configured()),
      client,
      crypto: fakeCrypto(),
    });
    await service.ready;
    await vi.waitFor(() => expect(client.getPlanning).toHaveBeenCalledTimes(1));
    const state = await service.clearApiKey();
    expect(state.hasApiKey).toBe(false);
    await vi.advanceTimersByTimeAsync(30 * 60_000);
    expect(client.getPlanning).toHaveBeenCalledTimes(1);
  });

  it('lists plannings, or reports unauthorized without a key', async () => {
    const withKey = make({
      store: memoryStore(configured()),
      client: stubClient(),
      crypto: fakeCrypto(),
    });
    expect(await withKey.listPlannings()).toEqual({
      status: 'ok',
      plannings: [
        {
          id: FIXTURE_PLANNING_ID,
          name: 'Test 24',
          car: null,
          isTeam: false,
          trackName: null,
          startAt: null,
        },
      ],
    });
    const noKey = make({
      store: memoryStore(),
      client: stubClient(),
      crypto: fakeCrypto(),
    });
    expect(await noKey.listPlannings()).toEqual({ status: 'unauthorized' });
  });

  it('notifies listeners of every change', async () => {
    const service = make({
      store: memoryStore(configured()),
      client: stubClient(),
      crypto: fakeCrypto(),
    });
    const listener = vi.fn();
    service.onChange(listener);
    await service.refreshNow();
    await service.setConfig({ refreshMinutes: 7 });
    const last = listener.mock.calls.at(-1)?.[0] as RacePlanState;
    expect(last.config.refreshMinutes).toBe(7);
    expect(last.planning?.id).toBe(FIXTURE_PLANNING_ID);
  });
});

describe('racePlanService validation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects bad input before touching storage', async () => {
    const store = memoryStore();
    const service = make({ store, client: stubClient(), crypto: fakeCrypto() });
    await expect(
      service.setConfig({ strategyId: 'drop table' })
    ).rejects.toThrow();
    await expect(service.setApiKey({ key: KEY })).rejects.toThrow();
    expect(store.save).not.toHaveBeenCalled();
  });
});
