import { app, BrowserWindow, Notification } from 'electron';
import { getStorageStatus, onStorageStatus } from '../storage/storageStatus';
import { defineRendererSubscriptionBridge } from './defineBridge';
import logger from '../logger';

export function setupStorageStatusBridge() {
  const subscriptions = defineRendererSubscriptionBridge({
    name: 'storageStatus',
    isValidKey: (value: unknown): value is 'status' => value === 'status',
    onSubscribe: (sender) =>
      sender.send('storageStatus:changed', getStorageStatus()),
  });
  const refresh = (_event: unknown, window: BrowserWindow) => {
    if (
      !window.isDestroyed() &&
      subscriptions.registry.has(window.webContents.id, 'status')
    ) {
      window.webContents.send('storageStatus:changed', getStorageStatus());
    }
  };
  app.on('browser-window-focus', refresh);
  let notification: Notification | undefined;
  const unsubscribe = onStorageStatus((status) => {
    for (const window of BrowserWindow.getAllWindows()) {
      if (
        !window.isDestroyed() &&
        window.isVisible() &&
        subscriptions.registry.has(window.webContents.id, 'status')
      ) {
        window.webContents.send('storageStatus:changed', status);
      }
    }
    // One OS notification per outage, shared across both storage files and
    // all windows. The settings banner remains until both files recover.
    try {
      if (status.diskFull && Notification.isSupported()) {
        notification = new Notification({
          title: 'irDashies: disk full',
          body: 'Fuel history or reference laps cannot be saved. Free disk space to resume saving.',
        });
        notification.show();
      } else if (!status.diskFull) {
        notification?.close();
        notification = undefined;
      }
    } catch {
      logger.warn('[Storage] Could not display native notification');
    }
  });
  return () => {
    unsubscribe();
    app.removeListener('browser-window-focus', refresh);
    subscriptions.dispose();
    notification?.close();
  };
}
