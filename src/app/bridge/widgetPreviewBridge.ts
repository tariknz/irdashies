import { BrowserWindow, ipcMain, type WebContents } from 'electron';
import { channelRegistry } from '@irdashies/types';
import {
  WIDGET_PREVIEW_IPC,
  WIDGET_PREVIEW_STATUS_SUBSCRIPTION,
  type WidgetPreviewStatus,
} from '../../types/widgetPreview';
import { createWidgetPreviewRuntime } from './widgetPreviewRuntime';
import {
  defineRendererSubscriptionBridge,
  onRendererPageGone,
} from './defineBridge';
import { TelemetryPerfMetrics } from '../perfMetrics';
import logger from '../logger';
import type { ProcessorMetrics } from '../processors/ProcessorHost';

/** The part of the session lifecycle the preview follows. */
export interface PreviewDrivingSource {
  onDrivingStateChange(callback: (isDriving: boolean) => void): () => void;
  onDisconnect(callback: () => void): () => void;
  getCurrentState(): { isDriving: boolean | undefined };
}

type PreviewRuntime = ReturnType<typeof createWidgetPreviewRuntime>;

/** Where the window is, as its events have told it since watching began. */
interface WindowVisibility {
  minimized: boolean;
  trayHidden: boolean;
  stop(): void;
}

/**
 * One settings page, keyed by its webContents: its demo while connected, and
 * the watch on its window while it subscribes to the status. Released once it
 * has neither, or when the page goes.
 */
interface PreviewPage {
  readonly contents: WebContents;
  statusSubscribed: boolean;
  /** Unset while not subscribed, or when the page has no window to watch. */
  visibility?: WindowVisibility;
  runtime?: PreviewRuntime;
  /** The status last sent, so only changes are sent. */
  sent?: WidgetPreviewStatus;
  stopWatchingPage(): void;
}

/**
 * Serves the settings windows' widget previews: one demo per window, created
 * when its page connects and disposed when it disconnects.
 *
 * The page stops its preview, demo and frame both, while it is paused, and
 * starts a new one on Play. Main tells it the two reasons only main can see,
 * through the status subscription: its window being minimised or closed to
 * the tray, and the player being in the car.
 *
 * The window's visibility comes from its own events. Settings windows run
 * with backgroundThrottling off, which Electron documents as also affecting
 * the Page Visibility API, so the page can keep reporting itself visible
 * while minimised or hidden.
 *
 * Being in the car comes from the session lifecycle, which every simulator
 * feeds and Demo Mode does not. Stopping a simulator's bridge reports a
 * disconnect, so switching to Demo Mode, or the sim closing, also ends it.
 * The overlays' Demo Mode is never touched.
 */
export function setupWidgetPreviewBridge(
  metrics: ProcessorMetrics = new TelemetryPerfMetrics(),
  driving?: PreviewDrivingSource
) {
  const pages = new Map<number, PreviewPage>();
  let isDriving = false;

  const isHidden = (page: PreviewPage) =>
    !!page.visibility &&
    (page.visibility.minimized || page.visibility.trayHidden);

  const report = (page: PreviewPage) => {
    if (!page.statusSubscribed || page.contents.isDestroyed()) return;
    const status: WidgetPreviewStatus = {
      windowHidden: isHidden(page),
      driving: isDriving,
    };
    if (
      page.sent?.windowHidden === status.windowHidden &&
      page.sent.driving === status.driving
    )
      return;
    page.sent = status;
    page.contents.send(WIDGET_PREVIEW_IPC.status, status);
  };

  const closeDemo = (page: PreviewPage) => {
    page.runtime?.dispose();
    page.runtime = undefined;
  };

  const release = (page: PreviewPage) => {
    closeDemo(page);
    page.visibility?.stop();
    page.visibility = undefined;
    page.stopWatchingPage();
    if (pages.get(page.contents.id) === page) pages.delete(page.contents.id);
  };

  /**
   * Follows the window from its events rather than reading it back, since
   * what the window reports while it emits one of them can lag behind. A
   * focused window is on screen whatever was missed, so focus clears both.
   */
  const watchWindow = (page: PreviewPage): WindowVisibility | undefined => {
    const window = BrowserWindow.fromWebContents(page.contents);
    if (!window || window.isDestroyed()) return undefined;
    const minimized = window.isMinimized();
    const set = (next: { minimized?: boolean; trayHidden?: boolean }) => {
      Object.assign(visibility, next);
      report(page);
    };
    const onMinimize = () => set({ minimized: true });
    const onRestore = () => set({ minimized: false });
    const onHide = () => set({ trayHidden: true });
    const onShow = () => set({ trayHidden: false });
    const onFocus = () => set({ minimized: false, trayHidden: false });
    window.on('minimize', onMinimize);
    window.on('restore', onRestore);
    window.on('hide', onHide);
    window.on('show', onShow);
    window.on('focus', onFocus);
    const visibility: WindowVisibility = {
      minimized,
      // A minimised window may report itself not visible as well.
      trayHidden: !minimized && !window.isVisible(),
      stop: () => {
        window.removeListener('minimize', onMinimize);
        window.removeListener('restore', onRestore);
        window.removeListener('hide', onHide);
        window.removeListener('show', onShow);
        window.removeListener('focus', onFocus);
      },
    };
    return visibility;
  };

  /** Brings the page's window watch and record in line with its use. */
  const update = (page: PreviewPage) => {
    if (!page.statusSubscribed) {
      page.visibility?.stop();
      page.visibility = undefined;
      page.sent = undefined;
      if (!page.runtime) release(page);
      return;
    }
    page.visibility ??= watchWindow(page);
    report(page);
  };

  const open = (contents: WebContents): PreviewPage => {
    const existing = pages.get(contents.id);
    if (existing) return existing;
    const page: PreviewPage = {
      contents,
      statusSubscribed: false,
      stopWatchingPage: onRendererPageGone(contents, () => release(page)),
    };
    pages.set(contents.id, page);
    return page;
  };

  const subscriptions = defineRendererSubscriptionBridge({
    name: WIDGET_PREVIEW_STATUS_SUBSCRIPTION,
    isValidKey: (value: unknown): value is 'status' => value === 'status',
    onSubscribe: (sender) => {
      const page = open(sender);
      page.statusSubscribed = true;
      // Every subscribe is answered: it is how a new consumer in the page
      // learns the current status.
      page.sent = undefined;
      update(page);
    },
    onUnsubscribe: (sender) => {
      const page = pages.get(sender.id);
      if (!page) return;
      page.statusSubscribed = false;
      update(page);
    },
  });

  const setDriving = (value: boolean) => {
    if (value === isDriving) return;
    isDriving = value;
    for (const page of pages.values()) report(page);
  };
  const stopDrivingChanges = driving?.onDrivingStateChange(setDriving);
  // A disconnect while driving resets the lifecycle without reporting the
  // player out of the car.
  const stopDisconnects = driving?.onDisconnect(() => setDriving(false));
  // Read after subscribing: the lifecycle only reports changes, and the
  // player may already have been in the car when this was set up.
  isDriving = driving?.getCurrentState().isDriving ?? false;

  const requireMainFrame = (event: Electron.IpcMainInvokeEvent) => {
    if (event.senderFrame !== event.sender.mainFrame)
      throw new Error('Only the main frame can request widget previews');
  };
  const validateChannel = (channel: unknown): string => {
    if (typeof channel !== 'string' || !Object.hasOwn(channelRegistry, channel))
      throw new Error('Invalid preview channel');
    return channel;
  };

  ipcMain.handle(WIDGET_PREVIEW_IPC.connect, (event) => {
    requireMainFrame(event);
    const sender = event.sender;
    const page = open(sender);
    closeDemo(page);
    let runtime: PreviewRuntime;
    try {
      runtime = createWidgetPreviewRuntime(
        {
          id: sender.id,
          isDestroyed: () => sender.isDestroyed(),
          // The page stops its demo whenever the preview is not shown, so a
          // connected demo is always one being shown.
          isVisible: () => true,
          send: (_ipc, channel, payload) =>
            sender.send(WIDGET_PREVIEW_IPC.delivery, channel, payload),
        },
        metrics,
        (message, error) => logger.error(message, error)
      );
    } catch (error) {
      // The previous demo is gone either way.
      update(page);
      throw error;
    }
    page.runtime = runtime;
    return runtime.getSession();
  });
  ipcMain.handle(WIDGET_PREVIEW_IPC.disconnect, (event) => {
    requireMainFrame(event);
    const page = pages.get(event.sender.id);
    if (!page) return;
    closeDemo(page);
    update(page);
  });
  ipcMain.handle(WIDGET_PREVIEW_IPC.telemetry, (event) => {
    requireMainFrame(event);
    return pages.get(event.sender.id)?.runtime?.getTelemetry() ?? null;
  });
  ipcMain.handle(
    WIDGET_PREVIEW_IPC.subscribe,
    (event, channel: unknown, rate: unknown) => {
      requireMainFrame(event);
      const name = validateChannel(channel);
      if (
        rate !== undefined &&
        (typeof rate !== 'number' || !Number.isFinite(rate))
      )
        throw new Error('Invalid preview rate');
      const runtime = pages.get(event.sender.id)?.runtime;
      if (!runtime) throw new Error('Preview is not connected');
      runtime.subscribe(name, rate);
    }
  );
  ipcMain.handle(WIDGET_PREVIEW_IPC.unsubscribe, (event, channel: unknown) => {
    requireMainFrame(event);
    const name = validateChannel(channel);
    pages.get(event.sender.id)?.runtime?.unsubscribe(name);
  });

  return () => {
    stopDrivingChanges?.();
    stopDisconnects?.();
    subscriptions.dispose();
    for (const page of [...pages.values()]) release(page);
    for (const name of [
      'connect',
      'disconnect',
      'subscribe',
      'unsubscribe',
      'telemetry',
    ] as const)
      ipcMain.removeHandler(WIDGET_PREVIEW_IPC[name]);
  };
}
