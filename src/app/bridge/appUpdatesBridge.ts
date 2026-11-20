import { app, BrowserWindow, ipcMain } from 'electron';
import type { AppUpdateStatus } from '../../types/appUpdates';
import { createAppUpdates } from '../services/appUpdates';
import { defineRendererSubscriptionBridge } from './defineBridge';

export async function setupAppUpdatesBridge() {
  const subscriptions = defineRendererSubscriptionBridge({
    name: 'appUpdates',
    isValidKey: (value: unknown): value is 'status' => value === 'status',
    onSubscribe: async (sender) => {
      const updates = await service;
      if (
        sender.isDestroyed() ||
        !subscriptions.registry.has(sender.id, 'status')
      )
        return;
      sender.send('appUpdates:changed', updates.snapshot());
      void updates.checkLatest();
    },
  });
  const sendStatus = (window: BrowserWindow, status: AppUpdateStatus) => {
    if (
      !window.isDestroyed() &&
      window.isVisible() &&
      subscriptions.registry.has(window.webContents.id, 'status')
    ) {
      window.webContents.send('appUpdates:changed', status);
    }
  };
  const service = createAppUpdates((status) => {
    for (const window of BrowserWindow.getAllWindows())
      sendStatus(window, status);
  });
  const updates = await service;
  const refresh = (_event: unknown, window: BrowserWindow) =>
    sendStatus(window, updates.snapshot());
  app.on('browser-window-focus', refresh);
  ipcMain.handle('appUpdates:checkLatest', () => {
    void updates.checkLatest();
  });
  ipcMain.handle('appUpdates:setAutoUpdate', (_event, enabled: unknown) => {
    if (typeof enabled !== 'boolean') throw new TypeError('Expected a boolean');
    return updates.setAutoUpdate(enabled);
  });
  ipcMain.handle('appUpdates:install', () => updates.install());
  return {
    stop: () => {
      updates.stop();
      app.removeListener('browser-window-focus', refresh);
      subscriptions.dispose();
    },
    flush: updates.flush,
  };
}
