import { beforeEach, expect, it, vi } from 'vitest';
const mock = vi.hoisted(() => ({
  listeners: new Set<(event: unknown, value: unknown) => void>(),
  invoke: vi.fn(async () => undefined),
  send: vi.fn(),
}));
vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
  ipcMain: {},
  ipcRenderer: {
    on: (
      _channel: string,
      callback: (event: unknown, value: unknown) => void
    ) => mock.listeners.add(callback),
    removeListener: (
      _channel: string,
      callback: (event: unknown, value: unknown) => void
    ) => mock.listeners.delete(callback),
    invoke: mock.invoke,
    send: mock.send,
  },
}));
import { exposeStorageStatusBridge } from './storageStatusRendererBridge';

beforeEach(() => {
  mock.listeners.clear();
  vi.clearAllMocks();
});

it('validates received status, releases listeners and unsubscribes only after the last consumer', () => {
  const bridge = exposeStorageStatusBridge();
  const first = vi.fn();
  const second = vi.fn();
  const removeFirst = bridge.onStatus(first);
  const removeSecond = bridge.onStatus(second);
  for (const callback of mock.listeners) {
    callback({}, { diskFull: 'yes' });
    callback({}, null);
    callback({}, { diskFull: true });
  }
  expect(first).toHaveBeenCalledExactlyOnceWith({ diskFull: true });
  expect(second).toHaveBeenCalledExactlyOnceWith({ diskFull: true });
  mock.invoke.mockClear();
  removeFirst();
  removeFirst();
  expect(mock.invoke).not.toHaveBeenCalled();
  removeSecond();
  expect(mock.invoke).toHaveBeenCalledExactlyOnceWith(
    'storageStatus:unsubscribe',
    'status'
  );
  expect(mock.listeners.size).toBe(0);
});

it('handles subscription failure without dropping a rejected promise', async () => {
  mock.invoke.mockRejectedValueOnce(new Error('closed'));
  const cleanup = exposeStorageStatusBridge().onStatus(vi.fn());
  await Promise.resolve();
  expect(mock.send).toHaveBeenCalledWith(
    'log',
    'warn',
    '[Storage] Status subscription failed'
  );
  cleanup();
});
