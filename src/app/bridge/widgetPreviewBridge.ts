import { BrowserWindow, ipcMain } from 'electron';
import { channelRegistry } from '@irdashies/types';
import { WIDGET_PREVIEW_IPC } from '../../types/widgetPreview';
import { createWidgetPreviewRuntime } from './widgetPreviewRuntime';
import {
  setupWidgetPreviewHold,
  type PreviewDrivingSource,
} from './widgetPreviewHold';
import { TelemetryPerfMetrics } from '../perfMetrics';
import logger from '../logger';
import type { ProcessorMetrics } from '../processors/ProcessorHost';

export function setupWidgetPreviewBridge(
  metrics: ProcessorMetrics = new TelemetryPerfMetrics(),
  driving?: PreviewDrivingSource
) {
  const disposeHold = setupWidgetPreviewHold(driving);
  const clients = new Map<
    number,
    { runtime: ReturnType<typeof createWidgetPreviewRuntime>; cleanup(): void }
  >();

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
    clients.get(event.sender.id)?.cleanup();
    const sender = event.sender;
    const window = BrowserWindow.fromWebContents(sender);
    const runtime = createWidgetPreviewRuntime(
      {
        id: sender.id,
        isDestroyed: () => sender.isDestroyed(),
        isVisible: () => window?.isVisible() ?? false,
        send: (_ipc, channel, payload) =>
          sender.send(WIDGET_PREVIEW_IPC.delivery, channel, payload),
      },
      metrics,
      (message, error) => logger.error(message, error)
    );
    const show = () => runtime.show();
    const hide = () => runtime.hide();
    const cleanup = () => {
      sender.removeListener('destroyed', cleanup);
      sender.removeListener('did-start-navigation', onNavigate);
      window?.removeListener('show', show);
      window?.removeListener('restore', show);
      window?.removeListener('hide', hide);
      window?.removeListener('minimize', hide);
      runtime.dispose();
      clients.delete(sender.id);
    };
    const onNavigate = (
      _event: Electron.Event,
      _url: string,
      isInPlace: boolean,
      isMainFrame: boolean
    ) => {
      if (isMainFrame && !isInPlace) cleanup();
    };
    sender.once('destroyed', cleanup);
    sender.on('did-start-navigation', onNavigate);
    window?.on('show', show);
    window?.on('restore', show);
    window?.on('hide', hide);
    window?.on('minimize', hide);
    clients.set(sender.id, { runtime, cleanup });
    return runtime.getSession();
  });
  ipcMain.handle(WIDGET_PREVIEW_IPC.disconnect, (event) => {
    requireMainFrame(event);
    clients.get(event.sender.id)?.cleanup();
  });
  ipcMain.handle(WIDGET_PREVIEW_IPC.telemetry, (event) => {
    requireMainFrame(event);
    return clients.get(event.sender.id)?.runtime.getTelemetry() ?? null;
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
      const client = clients.get(event.sender.id);
      if (!client) throw new Error('Preview is not connected');
      client.runtime.subscribe(name, rate);
    }
  );
  ipcMain.handle(WIDGET_PREVIEW_IPC.unsubscribe, (event, channel: unknown) => {
    requireMainFrame(event);
    clients.get(event.sender.id)?.runtime.unsubscribe(validateChannel(channel));
  });
  return () => {
    disposeHold();
    for (const client of clients.values()) client.cleanup();
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
