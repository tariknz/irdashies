import { beforeEach, expect, it, vi } from 'vitest';
import { ipcRenderer } from 'electron';
import { exposeWindowVisibilityBridge } from './windowVisibilityRendererBridge';
vi.mock('electron', () => ({
  ipcRenderer: {
    on: vi.fn(),
    removeListener: vi.fn(),
    invoke: vi.fn(() => Promise.resolve()),
    send: vi.fn(),
  },
  ipcMain: {},
  contextBridge: { exposeInMainWorld: vi.fn() },
}));
beforeEach(() => vi.clearAllMocks());
it('validates state values and unsubscribes only after the last consumer', () => {
  const bridge = exposeWindowVisibilityBridge();
  const first = vi.fn(),
    second = vi.fn();
  const stopFirst = bridge.onVisibilityChanged(first);
  const stopSecond = bridge.onVisibilityChanged(second);
  const listener = vi.mocked(ipcRenderer.on).mock.calls[0][1];
  listener({} as Electron.IpcRendererEvent, 'false');
  expect(first).not.toHaveBeenCalled();
  listener({} as Electron.IpcRendererEvent, false);
  expect(first).toHaveBeenCalledWith(false);
  stopFirst();
  stopFirst();
  expect(ipcRenderer.invoke).not.toHaveBeenCalledWith(
    'windowVisibility:unsubscribe',
    'visible'
  );
  stopSecond();
  expect(ipcRenderer.invoke).toHaveBeenCalledWith(
    'windowVisibility:unsubscribe',
    'visible'
  );
  expect(ipcRenderer.removeListener).toHaveBeenCalledTimes(2);
});
