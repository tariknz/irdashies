import { app, BrowserWindow, ipcMain } from 'electron';
import { createAppUpdates } from '../services/appUpdates';
import { defineRendererSubscriptionBridge } from './defineBridge';

const RELEASE_LOOKUP_INTERVAL = 10 * 60 * 1000;

export async function setupAppUpdatesBridge() {
  let nextLatestCheck = 0;
  const checkLatest = (
    updates: Awaited<ReturnType<typeof createAppUpdates>>,
    force = false
  ) => {
    if (!force && Date.now() < nextLatestCheck) return;
    nextLatestCheck = Date.now() + RELEASE_LOOKUP_INTERVAL;
    void updates.checkLatest();
  };
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
      checkLatest(updates);
    },
  });
  const hasVisibleSubscriber = (window: BrowserWindow) =>
    !window.isDestroyed() &&
    window.isVisible() &&
    subscriptions.registry.has(window.webContents.id, 'status');
  const service = createAppUpdates((status) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (hasVisibleSubscriber(window))
        window.webContents.send('appUpdates:changed', status);
    }
  });
  const updates = await service;
  const refresh = (_event: unknown, window: BrowserWindow) => {
    if (!hasVisibleSubscriber(window)) return;
    window.webContents.send('appUpdates:changed', updates.snapshot());
    checkLatest(updates);
  };
  const lookupTimer = setInterval(() => {
    if (BrowserWindow.getAllWindows().some(hasVisibleSubscriber))
      checkLatest(updates);
  }, RELEASE_LOOKUP_INTERVAL);
  app.on('browser-window-focus', refresh);
  ipcMain.handle('appUpdates:checkLatest', () => {
    checkLatest(updates, true);
  });
  ipcMain.handle('appUpdates:setAutoUpdate', (_event, enabled: unknown) => {
    if (typeof enabled !== 'boolean') throw new TypeError('Expected a boolean');
    return updates.setAutoUpdate(enabled);
  });
  ipcMain.handle('appUpdates:install', (_event, action: unknown) => {
    if (action !== 'download' && action !== 'restart')
      throw new TypeError('Expected an update action');
    return updates.install(action);
  });
  return {
    stop: () => {
      updates.stop();
      clearInterval(lookupTimer);
      app.removeListener('browser-window-focus', refresh);
      subscriptions.dispose();
    },
    flush: updates.flush,
  };
}
