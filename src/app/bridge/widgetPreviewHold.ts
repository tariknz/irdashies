import { BrowserWindow, type WebContents } from 'electron';
import {
  WIDGET_PREVIEW_HOLD_SUBSCRIPTION,
  WIDGET_PREVIEW_IPC,
  type WidgetPreviewHold,
} from '../../types/widgetPreview';
import { defineRendererSubscriptionBridge } from './defineBridge';

/** The part of the session lifecycle the hold follows. */
export interface PreviewDrivingSource {
  onDrivingStateChange(callback: (isDriving: boolean) => void): () => void;
  onDisconnect(callback: () => void): () => void;
  getCurrentState(): { isDriving: boolean | undefined };
}

/**
 * Tells each settings window when to hold its widget preview paused: while
 * that window is minimised or closed to the tray, and while the player is in
 * the car.
 *
 * The page cannot be relied on to tell the first for itself. Settings windows
 * are created with backgroundThrottling off, which Electron documents as also
 * affecting the Page Visibility API: the page can keep reporting itself
 * visible while its window is minimised or hidden, and its own
 * visibilitychange check then never fires.
 *
 * Being in the car comes from the session lifecycle, which every simulator
 * feeds and Demo Mode does not. Stopping a simulator's bridge reports a
 * disconnect, so switching to Demo Mode, or the sim closing, also ends it.
 */
export function setupWidgetPreviewHold(driving?: PreviewDrivingSource) {
  let isDriving = false;
  const watched = new Map<
    number,
    { contents: WebContents; detach: () => void }
  >();

  const subscriptions = defineRendererSubscriptionBridge({
    name: WIDGET_PREVIEW_HOLD_SUBSCRIPTION,
    isValidKey: (value: unknown): value is 'hold' => value === 'hold',
    onSubscribe: (sender) => {
      watch(sender);
      send(sender);
    },
  });

  /**
   * `hidden` is given by the events that hide the window, rather than read
   * back from it, so the answer cannot depend on whether Electron has updated
   * the window's state by the time it emits the event.
   */
  const send = (contents: WebContents, hidden?: boolean) => {
    if (contents.isDestroyed()) return;
    if (!subscriptions.registry.has(contents.id, 'hold')) return;
    const window = BrowserWindow.fromWebContents(contents);
    if (!window || window.isDestroyed()) return;
    const hold: WidgetPreviewHold = {
      windowHidden: hidden ?? (!window.isVisible() || window.isMinimized()),
      driving: isDriving,
    };
    contents.send(WIDGET_PREVIEW_IPC.hold, hold);
  };

  const watch = (contents: WebContents) => {
    if (watched.has(contents.id)) return;
    const window = BrowserWindow.fromWebContents(contents);
    if (!window) return;
    const shown = () => send(contents);
    const hidden = () => send(contents, true);
    window.on('show', shown);
    window.on('restore', shown);
    window.on('hide', hidden);
    window.on('minimize', hidden);
    const detach = () => {
      window.removeListener('show', shown);
      window.removeListener('restore', shown);
      window.removeListener('hide', hidden);
      window.removeListener('minimize', hidden);
      contents.removeListener('destroyed', detach);
      watched.delete(contents.id);
    };
    contents.once('destroyed', detach);
    watched.set(contents.id, { contents, detach });
  };

  const setDriving = (value: boolean) => {
    if (value === isDriving) return;
    isDriving = value;
    for (const { contents } of watched.values()) send(contents);
  };
  const stopDriving = driving?.onDrivingStateChange(setDriving);
  // A disconnect while driving resets the lifecycle without reporting the
  // player out of the car.
  const stopDisconnect = driving?.onDisconnect(() => setDriving(false));
  // Read after subscribing: the lifecycle only reports changes, and the
  // player may already have been in the car when this was set up.
  isDriving = driving?.getCurrentState().isDriving ?? false;

  return () => {
    stopDriving?.();
    stopDisconnect?.();
    for (const { detach } of [...watched.values()]) detach();
    subscriptions.dispose();
  };
}
