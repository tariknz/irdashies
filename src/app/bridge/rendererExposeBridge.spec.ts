import { beforeEach, expect, it, vi } from 'vitest';
import type { RacePlanBridge, RacePlanState } from '@irdashies/types';
const mock = vi.hoisted(() => ({
  exposed: new Map<string, unknown>(),
  listeners: new Map<string, Set<(event: unknown, value: unknown) => void>>(),
  invoke: vi.fn(async () => undefined),
  send: vi.fn(),
}));
vi.mock('electron', () => ({
  contextBridge: {
    exposeInMainWorld: (name: string, api: unknown) =>
      mock.exposed.set(name, api),
  },
  ipcMain: {},
  ipcRenderer: {
    on: (
      channel: string,
      callback: (event: unknown, value: unknown) => void
    ) => {
      const set = mock.listeners.get(channel) ?? new Set();
      set.add(callback);
      mock.listeners.set(channel, set);
    },
    removeListener: (
      channel: string,
      callback: (event: unknown, value: unknown) => void
    ) => mock.listeners.get(channel)?.delete(callback),
    invoke: mock.invoke,
    send: mock.send,
  },
}));
import { exposeBridge } from './rendererExposeBridge';

const STATE: RacePlanState = {
  config: { planningId: null, strategyId: null, refreshMinutes: 5 },
  hasApiKey: false,
  canStoreApiKey: true,
  status: 'idle',
  fetchedAt: null,
  planning: null,
  strategyId: null,
};

const stateListeners = () => mock.listeners.get('racePlan:state') ?? new Set();

beforeEach(() => {
  mock.exposed.clear();
  mock.listeners.clear();
  vi.clearAllMocks();
});

it('shares one race plan subscription, passing on only well-formed states', () => {
  exposeBridge();
  const bridge = mock.exposed.get('racePlanBridge') as RacePlanBridge;
  const first = vi.fn();
  const second = vi.fn();
  const removeFirst = bridge.onStateChanged(first);
  const removeSecond = bridge.onStateChanged(second);
  for (const callback of stateListeners()) {
    callback({}, { ...STATE, hasApiKey: 'yes' });
    callback({}, { ...STATE, config: null });
    callback({}, undefined);
    callback({}, STATE);
  }
  expect(first).toHaveBeenCalledExactlyOnceWith(STATE);
  expect(second).toHaveBeenCalledExactlyOnceWith(STATE);
  mock.invoke.mockClear();
  removeFirst();
  removeFirst();
  expect(mock.invoke).not.toHaveBeenCalled();
  removeSecond();
  expect(mock.invoke).toHaveBeenCalledExactlyOnceWith(
    'racePlan:unsubscribe',
    'state'
  );
  expect(stateListeners().size).toBe(0);
});

it('logs a failed race plan subscription instead of dropping the rejection', async () => {
  exposeBridge();
  const bridge = mock.exposed.get('racePlanBridge') as RacePlanBridge;
  mock.invoke.mockRejectedValueOnce(new Error('closed'));
  const cleanup = bridge.onStateChanged(vi.fn());
  await Promise.resolve();
  expect(mock.send).toHaveBeenCalledWith(
    'log',
    'warn',
    '[RacePlan] State subscription failed'
  );
  cleanup();
});
