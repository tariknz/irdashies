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

/**
 * How long a paused demo runs once its window is on screen, before it is
 * held: long enough for the session, the first frames and the first
 * snapshots to reach the frame, which then keeps that picture rather than an
 * empty widget.
 */
export const PREVIEW_PRIMING_MS = 1000;

type PreviewRuntime = ReturnType<typeof createWidgetPreviewRuntime>;

/** Where the window is, as its events have told it since watching began. */
interface WindowVisibility {
  minimized: boolean;
  trayHidden: boolean;
  stop(): void;
}

/**
 * One settings page's preview, keyed by its webContents.
 *
 * The page's own choices (`pagePaused`, `playInCar`) last as long as the page,
 * so they hold across the widget pages it moves between. Everything else,
 * the window's listeners included, lasts only while the page subscribes to
 * the status or has a demo connected.
 */
interface PreviewPage {
  readonly contents: WebContents;
  pagePaused: boolean;
  playInCar: boolean;
  statusSubscribed: boolean;
  /** Unset while not in use, or when the page has no window to watch. */
  visibility?: WindowVisibility;
  runtime?: PreviewRuntime;
  /** What the runtime was last told; false without one. */
  running: boolean;
  /** The runtime has run while its window was on screen. */
  pictured: boolean;
  priming?: ReturnType<typeof setTimeout>;
  /** The status last sent, so only changes are sent. */
  sent?: WidgetPreviewStatus;
  stopWatchingPage(): void;
}

const sameStatus = (a: WidgetPreviewStatus, b: WidgetPreviewStatus) =>
  a.windowHidden === b.windowHidden &&
  a.driving === b.driving &&
  a.playInCar === b.playInCar &&
  a.running === b.running;

/**
 * Serves the settings windows' widget previews: one demo per window, which
 * main pauses in place, so a resumed preview carries on where it stopped.
 *
 * A window's demo runs unless its page paused it (the Pause button, or the
 * page being hidden), the window is minimised or closed to the tray, or the
 * player is in the car and Play was not pressed there. Main tells the page
 * which through the status subscription.
 *
 * The window's visibility comes from its own events, here only. Settings
 * windows run with backgroundThrottling off, which Electron documents as
 * also affecting the Page Visibility API, so the page can keep reporting
 * itself visible while minimised or hidden. The same state gates the demo's
 * channel delivery.
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
  const shouldRun = (page: PreviewPage) =>
    !page.pagePaused && !isHidden(page) && !(isDriving && !page.playInCar);

  const report = (page: PreviewPage) => {
    if (!page.statusSubscribed || page.contents.isDestroyed()) return;
    const status: WidgetPreviewStatus = {
      windowHidden: isHidden(page),
      driving: isDriving,
      playInCar: page.playInCar,
      running: page.running,
    };
    if (page.sent && sameStatus(page.sent, status)) return;
    page.sent = status;
    page.contents.send(WIDGET_PREVIEW_IPC.status, status);
  };

  const stopPriming = (page: PreviewPage) => {
    clearTimeout(page.priming);
    page.priming = undefined;
  };

  const closeDemo = (page: PreviewPage) => {
    stopPriming(page);
    page.runtime?.dispose();
    page.runtime = undefined;
    page.running = false;
    page.pictured = false;
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
      const wasHidden = isHidden(page);
      Object.assign(visibility, next);
      const hidden = isHidden(page);
      // After the change: the bus reads the target's isVisible.
      if (hidden !== wasHidden) {
        if (hidden) page.runtime?.hide();
        else page.runtime?.show();
      }
      update(page);
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

  /**
   * Brings the page's window watch, demo and status in line with its state;
   * called after every change to it.
   */
  function update(page: PreviewPage) {
    if (!page.statusSubscribed && !page.runtime) {
      page.visibility?.stop();
      page.visibility = undefined;
      page.sent = undefined;
      // Kept while it holds the page's own choices for its next preview.
      if (!page.pagePaused && !page.playInCar) release(page);
      return;
    }
    page.visibility ??= watchWindow(page);
    const { runtime } = page;
    if (runtime) {
      const run = shouldRun(page);
      if (run) page.pictured = true;
      // A paused demo still runs once while its window is on screen, so the
      // frame has a picture to keep. Not while hidden: the frame would get
      // none of it, so it waits until the window is back.
      const prime = !run && !page.pictured && !isHidden(page);
      if (!prime) stopPriming(page);
      else if (page.priming === undefined) {
        page.priming = setTimeout(() => {
          page.priming = undefined;
          page.pictured = true;
          update(page);
        }, PREVIEW_PRIMING_MS);
      }
      const next = run || prime;
      if (next !== page.running) {
        page.running = next;
        runtime.setRunning(next);
      }
    }
    report(page);
  }

  const open = (contents: WebContents): PreviewPage => {
    const existing = pages.get(contents.id);
    if (existing) return existing;
    const page: PreviewPage = {
      contents,
      pagePaused: false,
      playInCar: false,
      statusSubscribed: false,
      running: false,
      pictured: false,
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
    for (const page of [...pages.values()]) {
      // Play in the car lasts until the player gets out.
      if (!value) page.playInCar = false;
      update(page);
    }
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
          // The state that pauses the demo also gates its delivery.
          isVisible: () => !isHidden(page),
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
    // Decided here, once: a demo that should be paused is primed and held,
    // never created and then replaced.
    page.runtime = runtime;
    page.running = true;
    update(page);
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
  ipcMain.handle(WIDGET_PREVIEW_IPC.setPaused, (event, paused: unknown) => {
    requireMainFrame(event);
    if (typeof paused !== 'boolean') throw new Error('Invalid preview pause');
    const page = open(event.sender);
    page.pagePaused = paused;
    update(page);
  });
  ipcMain.handle(WIDGET_PREVIEW_IPC.playInCar, (event) => {
    requireMainFrame(event);
    // Main's own state, not the status the page last saw: Play pressed just
    // as the player got out must not run the preview the next time in.
    if (!isDriving) return;
    const page = open(event.sender);
    page.playInCar = true;
    update(page);
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
      'setPaused',
      'playInCar',
    ] as const)
      ipcMain.removeHandler(WIDGET_PREVIEW_IPC[name]);
  };
}
