import { ipcRenderer } from 'electron';
import {
  isWidgetPreviewStatus,
  WIDGET_PREVIEW_IPC,
  WIDGET_PREVIEW_STATUS_SUBSCRIPTION,
  type WidgetPreviewBridge,
} from '../../types/widgetPreview';
import { createSharedSubscription, defineBridge } from './defineBridge';
import { createChannelRendererBridge } from './channelRendererBridge';

export const exposeWidgetPreviewBridge = () =>
  defineBridge<WidgetPreviewBridge>('widgetPreviewBridge', {
    ...createChannelRendererBridge(WIDGET_PREVIEW_IPC),
    connect: () => ipcRenderer.invoke(WIDGET_PREVIEW_IPC.connect),
    disconnect: () => ipcRenderer.invoke(WIDGET_PREVIEW_IPC.disconnect),
    getTelemetry: () => ipcRenderer.invoke(WIDGET_PREVIEW_IPC.telemetry),
    onStatus: createSharedSubscription({
      name: WIDGET_PREVIEW_STATUS_SUBSCRIPTION,
      key: 'status',
      channel: WIDGET_PREVIEW_IPC.status,
      // Rebuilt, so nothing but the status crosses into the page.
      parse: (value) =>
        isWidgetPreviewStatus(value)
          ? {
              windowHidden: value.windowHidden,
              driving: value.driving,
              playInCar: value.playInCar,
              running: value.running,
            }
          : undefined,
      label: '[WidgetPreview] Status',
    }),
    setPaused: (paused) =>
      ipcRenderer.invoke(WIDGET_PREVIEW_IPC.setPaused, paused),
    playInCar: () => ipcRenderer.invoke(WIDGET_PREVIEW_IPC.playInCar),
  });
