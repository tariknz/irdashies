import { ipcRenderer } from 'electron';
import {
  isWidgetPreviewHold,
  WIDGET_PREVIEW_HOLD_SUBSCRIPTION,
  WIDGET_PREVIEW_IPC,
  type WidgetPreviewBridge,
} from '../../types/widgetPreview';
import { createSubscriptionBridgeClient, defineBridge } from './defineBridge';
import { createChannelRendererBridge } from './channelRendererBridge';

export const exposeWidgetPreviewBridge = () => {
  const holdSubscription = createSubscriptionBridgeClient<'hold'>(
    WIDGET_PREVIEW_HOLD_SUBSCRIPTION
  );
  // Consumers share one per-window subscription; callbacks never live in main.
  let holdConsumers = 0;
  return defineBridge<WidgetPreviewBridge>('widgetPreviewBridge', {
    ...createChannelRendererBridge(WIDGET_PREVIEW_IPC),
    connect: () => ipcRenderer.invoke(WIDGET_PREVIEW_IPC.connect),
    disconnect: () => ipcRenderer.invoke(WIDGET_PREVIEW_IPC.disconnect),
    getTelemetry: () => ipcRenderer.invoke(WIDGET_PREVIEW_IPC.telemetry),
    onHold(callback) {
      const listener = (_event: Electron.IpcRendererEvent, value: unknown) => {
        if (isWidgetPreviewHold(value)) {
          callback({
            windowHidden: value.windowHidden,
            driving: value.driving,
          });
        }
      };
      ipcRenderer.on(WIDGET_PREVIEW_IPC.hold, listener);
      holdConsumers++;
      // Each subscribe makes main send the current hold, which is how a new
      // consumer learns it without waiting for the next change.
      void holdSubscription
        .subscribe('hold')
        .catch(() =>
          ipcRenderer.send(
            'log',
            'warn',
            '[WidgetPreview] Hold subscription failed'
          )
        );
      let active = true;
      return () => {
        if (!active) return;
        active = false;
        ipcRenderer.removeListener(WIDGET_PREVIEW_IPC.hold, listener);
        if (--holdConsumers === 0) {
          void holdSubscription
            .unsubscribe('hold')
            .catch(() =>
              ipcRenderer.send(
                'log',
                'warn',
                '[WidgetPreview] Hold unsubscribe failed'
              )
            );
        }
      };
    },
  });
};
