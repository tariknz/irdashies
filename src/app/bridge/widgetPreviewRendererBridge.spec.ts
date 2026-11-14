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

const statusListeners = () =>
  mock.listeners.get(WIDGET_PREVIEW_IPC.status) ?? new Set();

const STATUS = {
  windowHidden: true,
  driving: false,
  playInCar: false,
  running: true,
};

beforeEach(() => {
  mock.listeners.clear();
  vi.clearAllMocks();
});

it('passes on only well-formed statuses and unsubscribes after the last consumer', () => {
  const bridge = exposeWidgetPreviewBridge();
  const first = vi.fn();
  const second = vi.fn();
  const removeFirst = bridge.onStatus(first);
  const removeSecond = bridge.onStatus(second);
  // Each consumer subscribes: main answers with the current status.
  expect(mock.invoke.mock.calls).toEqual([
    ['widget-preview-status:subscribe', 'status'],
    ['widget-preview-status:subscribe', 'status'],
  ]);
  for (const callback of statusListeners()) {
    callback({}, { ...STATUS, windowHidden: 'yes' });
    callback({}, { windowHidden: true, driving: false });
    callback({}, { ...STATUS, running: undefined });
    callback({}, null);
    callback({}, { ...STATUS, extra: 1 });
  }
  expect(first).toHaveBeenCalledExactlyOnceWith(STATUS);
  expect(second).toHaveBeenCalledExactlyOnceWith(STATUS);
  mock.invoke.mockClear();
  removeFirst();
  removeFirst();
  expect(mock.invoke).not.toHaveBeenCalled();
  removeSecond();
  expect(mock.invoke).toHaveBeenCalledExactlyOnceWith(
    'widget-preview-status:unsubscribe',
    'status'
  );
  expect(statusListeners().size).toBe(0);
});

it('logs a failed subscription instead of dropping the rejection', async () => {
  mock.invoke.mockRejectedValueOnce(new Error('closed'));
  const cleanup = exposeWidgetPreviewBridge().onStatus(vi.fn());
  await Promise.resolve();
  expect(mock.send).toHaveBeenCalledWith(
    'log',
    'warn',
    '[WidgetPreview] Status subscription failed'
  );
  cleanup();
});

it('sends the page pause and Play in the car to main', async () => {
  const bridge = exposeWidgetPreviewBridge();
  await bridge.setPaused(true);
  await bridge.playInCar();
  expect(mock.invoke.mock.calls).toEqual([
    [WIDGET_PREVIEW_IPC.setPaused, true],
    [WIDGET_PREVIEW_IPC.playInCar],
  ]);
});
