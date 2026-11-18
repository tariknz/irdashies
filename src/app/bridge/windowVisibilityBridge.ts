import { app, BrowserWindow } from 'electron';
import { defineRendererSubscriptionBridge } from './defineBridge';

/** Native state changes only; this never changes telemetry or Gantry delivery. */
export const setupWindowVisibilityBridge = () => {
  const subscriptions = defineRendererSubscriptionBridge({
    name: 'windowVisibility',
    isValidKey: (value: unknown): value is 'visible' => value === 'visible',
    onSubscribe: (sender) => {
      const window = BrowserWindow.fromWebContents(sender);
      if (window && !window.isDestroyed()) notify(window);
    },
  });
  const cleanups = new Map<number, () => void>();
  const notify = (window: BrowserWindow) => {
    if (
      !window.isDestroyed() &&
      subscriptions.registry.has(window.webContents.id, 'visible')
    ) {
      window.webContents.send(
        'windowVisibility:changed',
        window.isVisible() && !window.isMinimized()
      );
    }
  };
  const attach = (window: BrowserWindow) => {
    if (window.isDestroyed() || cleanups.has(window.id)) return;
    const changed = () => notify(window);
    const cleanup = () => {
      window.removeListener('show', changed);
      window.removeListener('hide', changed);
      window.removeListener('minimize', changed);
      window.removeListener('restore', changed);
      window.removeListener('closed', cleanup);
      cleanups.delete(window.id);
    };
    window.on('show', changed);
    window.on('hide', changed);
    window.on('minimize', changed);
    window.on('restore', changed);
    window.once('closed', cleanup);
    cleanups.set(window.id, cleanup);
  };
  const created = (_event: unknown, window: BrowserWindow) => attach(window);
  BrowserWindow.getAllWindows().forEach(attach);
  app.on('browser-window-created', created);
  return () => {
    app.removeListener('browser-window-created', created);
    for (const cleanup of cleanups.values()) cleanup();
    subscriptions.dispose();
  };
};
