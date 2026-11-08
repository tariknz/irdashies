import { ipcRenderer } from 'electron';
import {
  WIDGET_PREVIEW_IPC,
  type WidgetPreviewBridge,
} from '../../types/widgetPreview';
import { defineBridge } from './defineBridge';
import { createChannelRendererBridge } from './channelRendererBridge';

export const exposeWidgetPreviewBridge = () =>
  defineBridge<WidgetPreviewBridge>('widgetPreviewBridge', {
    ...createChannelRendererBridge(WIDGET_PREVIEW_IPC),
    connect: () => ipcRenderer.invoke(WIDGET_PREVIEW_IPC.connect),
    disconnect: () => ipcRenderer.invoke(WIDGET_PREVIEW_IPC.disconnect),
    getTelemetry: () => ipcRenderer.invoke(WIDGET_PREVIEW_IPC.telemetry),
  });
