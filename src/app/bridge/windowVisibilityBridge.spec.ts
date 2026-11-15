import { EventEmitter } from 'node:events';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { app, BrowserWindow, ipcMain } from 'electron';
import { setupWindowVisibilityBridge } from './windowVisibilityBridge';
vi.mock('electron', () => ({
  app: { on: vi.fn(), removeListener: vi.fn() },
  BrowserWindow: { getAllWindows: vi.fn(), fromWebContents: vi.fn() },
  ipcMain: { handle: vi.fn(), removeHandler: vi.fn() },
  ipcRenderer: {},
  contextBridge: {},
}));
let dispose: (() => void) | undefined;
beforeEach(() => vi.clearAllMocks());
afterEach(() => dispose?.());
const setup = () => {
  let visible = true,
    minimized = false;
  const sender = Object.assign(new EventEmitter(), { id: 11, send: vi.fn() });
  const window = Object.assign(new EventEmitter(), {
    id: 21,
    webContents: sender,
    isDestroyed: () => false,
    isVisible: () => visible,
    isMinimized: () => minimized,
  });
  vi.mocked(BrowserWindow.getAllWindows).mockReturnValue([
    window as unknown as Electron.BrowserWindow,
  ]);
  vi.mocked(BrowserWindow.fromWebContents).mockReturnValue(
    window as unknown as Electron.BrowserWindow
  );
  dispose = setupWindowVisibilityBridge();
  const handler = (name: string) =>
    vi
      .mocked(ipcMain.handle)
      .mock.calls.find(([channel]) => channel === name)?.[1];
  const event = { sender } as unknown as Electron.IpcMainInvokeEvent;
  return {
    sender,
    window,
    event,
    handler,
    state: (v: boolean, m = false) => {
      visible = v;
      minimized = m;
    },
  };
};
it('seeds native state, delivers hide/show/minimize/restore and validates requests', () => {
  const { sender, window, event, handler, state } = setup();
  expect(() =>
    handler('windowVisibility:subscribe')?.(event, 'arbitrary')
  ).toThrow();
  handler('windowVisibility:subscribe')?.(event, 'visible');
  expect(sender.send).toHaveBeenLastCalledWith(
    'windowVisibility:changed',
    true
  );
  state(false);
  window.emit('hide');
  expect(sender.send).toHaveBeenLastCalledWith(
    'windowVisibility:changed',
    false
  );
  state(true);
  window.emit('show');
  expect(sender.send).toHaveBeenLastCalledWith(
    'windowVisibility:changed',
    true
  );
  state(true, true);
  window.emit('minimize');
  expect(sender.send).toHaveBeenLastCalledWith(
    'windowVisibility:changed',
    false
  );
  state(true);
  window.emit('restore');
  expect(sender.send).toHaveBeenLastCalledWith(
    'windowVisibility:changed',
    true
  );
  handler('windowVisibility:unsubscribe')?.(event, 'visible');
  sender.send.mockClear();
  window.emit('hide');
  expect(sender.send).not.toHaveBeenCalled();
});
it('cleans window/app listeners and prevents delivery after sender destruction', () => {
  const { sender, window, event, handler } = setup();
  handler('windowVisibility:subscribe')?.(event, 'visible');
  sender.emit('destroyed');
  sender.send.mockClear();
  window.emit('hide');
  expect(sender.send).not.toHaveBeenCalled();
  window.emit('closed');
  expect(window.listenerCount('hide')).toBe(0);
  expect(window.listenerCount('restore')).toBe(0);
  dispose?.();
  dispose = undefined;
  expect(app.removeListener).toHaveBeenCalledWith(
    'browser-window-created',
    expect.any(Function)
  );
  expect(ipcMain.removeHandler).toHaveBeenCalledWith(
    'windowVisibility:subscribe'
  );
});
