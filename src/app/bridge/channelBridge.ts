import { ipcMain, BrowserWindow } from 'electron';
import {
  CHANNEL_SUBSCRIBE,
  CHANNEL_UNSUBSCRIBE,
  type ChannelBus,
  type RendererTarget,
} from './channelBus';

// The bus itself is host-agnostic and lives in `channelBus.ts` so it can run
// outside Electron. This module is the Electron binding: it wires the bus to
// `ipcMain` and to `BrowserWindow` visibility. Re-exported here so existing
// main-process imports keep working unchanged.
export {
  ChannelBus,
  CHANNEL_SUBSCRIBE,
  CHANNEL_UNSUBSCRIBE,
  CHANNEL_DELIVERY,
} from './channelBus';
export type {
  ChannelBusMetricsSnapshot,
  RendererTarget,
  TimerHandle,
} from './channelBus';

const targetFor = (sender: Electron.WebContents): RendererTarget => ({
  id: sender.id,
  isDestroyed: () => sender.isDestroyed(),
  isVisible: () => BrowserWindow.fromWebContents(sender)?.isVisible() ?? false,
  send: (channel, name, payload) => sender.send(channel, name, payload),
});

export const setupChannelBridge = (bus: ChannelBus): (() => void) => {
  const rendererCleanup = new Map<number, () => void>();
  ipcMain.handle(
    CHANNEL_SUBSCRIBE,
    (event, channel: unknown, rate: unknown) => {
      if (typeof channel !== 'string') throw new Error('Invalid channel name');
      if (rate !== undefined && typeof rate !== 'number') {
        throw new Error('Invalid channel rate');
      }
      if (!rendererCleanup.has(event.sender.id)) {
        const window = BrowserWindow.fromWebContents(event.sender);
        const onShow = () => bus.rendererBecameVisible(event.sender.id);
        const onHide = () => bus.rendererBecameHidden(event.sender.id);
        // `minimize`/`restore` are distinct from `hide`/`show`: Electron never
        // emits `show` when a window returns from the minimised state. Without
        // the `restore` listener a subscription deactivated by `publish()` — it
        // deactivates on `isVisible() === false` but never reactivates — would
        // stay dead for the life of the renderer.
        window?.on('show', onShow);
        window?.on('hide', onHide);
        window?.on('restore', onShow);
        window?.on('minimize', onHide);
        const cleanup = () => {
          window?.removeListener('show', onShow);
          window?.removeListener('hide', onHide);
          window?.removeListener('restore', onShow);
          window?.removeListener('minimize', onHide);
          rendererCleanup.delete(event.sender.id);
          bus.removeRenderer(event.sender.id);
        };
        rendererCleanup.set(event.sender.id, cleanup);
        event.sender.once('destroyed', () => {
          cleanup();
        });
      }
      bus.subscribe(targetFor(event.sender), channel, rate);
    }
  );
  ipcMain.handle(CHANNEL_UNSUBSCRIBE, (event, channel: unknown) => {
    if (typeof channel !== 'string') throw new Error('Invalid channel name');
    bus.unsubscribe(event.sender.id, channel);
  });
  return () => {
    ipcMain.removeHandler(CHANNEL_SUBSCRIBE);
    ipcMain.removeHandler(CHANNEL_UNSUBSCRIBE);
    for (const cleanup of rendererCleanup.values()) cleanup();
    rendererCleanup.clear();
    bus.dispose();
  };
};
