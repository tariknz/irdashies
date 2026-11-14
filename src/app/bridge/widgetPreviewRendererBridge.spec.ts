import { beforeEach, expect, it, vi } from 'vitest';
import { WIDGET_PREVIEW_IPC } from '../../types/widgetPreview';
const mock = vi.hoisted(() => ({
  listeners: new Map<string, Set<(event: unknown, value: unknown) => void>>(),
  invoke: vi.fn(async () => undefined),
  send: vi.fn(),
}));
vi.mock('electron', () => ({
  contextBridge: { exposeInMainWorld: vi.fn() },
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
import { exposeWidgetPreviewBridge } from './widgetPreviewRendererBridge';

const holdListeners = () =>
  mock.listeners.get(WIDGET_PREVIEW_IPC.hold) ?? new Set();

beforeEach(() => {
  mock.listeners.clear();
  vi.clearAllMocks();
});

it('passes on only well-formed holds and unsubscribes after the last consumer', () => {
  const bridge = exposeWidgetPreviewBridge();
  const first = vi.fn();
  const second = vi.fn();
  const removeFirst = bridge.onHold(first);
  const removeSecond = bridge.onHold(second);
  expect(mock.invoke).toHaveBeenCalledWith(
    'widget-preview-hold:subscribe',
    'hold'
  );
  for (const callback of holdListeners()) {
    callback({}, { windowHidden: 'yes', driving: false });
    callback({}, { windowHidden: true });
    callback({}, null);
    callback({}, { windowHidden: true, driving: false, extra: 1 });
  }
  expect(first).toHaveBeenCalledExactlyOnceWith({
    windowHidden: true,
    driving: false,
  });
  expect(second).toHaveBeenCalledExactlyOnceWith({
    windowHidden: true,
    driving: false,
  });
  mock.invoke.mockClear();
  removeFirst();
  removeFirst();
  expect(mock.invoke).not.toHaveBeenCalled();
  removeSecond();
  expect(mock.invoke).toHaveBeenCalledExactlyOnceWith(
    'widget-preview-hold:unsubscribe',
    'hold'
  );
  expect(holdListeners().size).toBe(0);
});

it('logs a failed subscription instead of dropping the rejection', async () => {
  mock.invoke.mockRejectedValueOnce(new Error('closed'));
  const cleanup = exposeWidgetPreviewBridge().onHold(vi.fn());
  await Promise.resolve();
  expect(mock.send).toHaveBeenCalledWith(
    'log',
    'warn',
    '[WidgetPreview] Hold subscription failed'
  );
  cleanup();
});
