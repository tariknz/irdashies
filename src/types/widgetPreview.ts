import type { ChannelBridge, ChannelName, ChannelPayloads } from './channels';
import type { DashboardLayout } from './dashboardLayout';
import type { Session } from './session';
import type { Telemetry } from './telemetry';

/** A separate demo source; never changes the simulator feeding live overlays. */
export interface WidgetPreviewBridge extends ChannelBridge {
  connect(): Promise<Session>;
  disconnect(): Promise<void>;
  /** Only requested while the raw telemetry inspector is being previewed. */
  getTelemetry(): Promise<Telemetry | null>;
}

export const WIDGET_PREVIEW_IPC = {
  connect: 'widget-preview:connect',
  disconnect: 'widget-preview:disconnect',
  subscribe: 'widget-preview:subscribe',
  unsubscribe: 'widget-preview:unsubscribe',
  delivery: 'widget-preview:delivery',
  telemetry: 'widget-preview:telemetry',
} as const;

export interface WidgetPreviewConfig {
  widgetId: string;
  dashboard: DashboardLayout;
}

export type WidgetPreviewRequest =
  | { type: 'preview:ready' }
  | {
      type: 'preview:asset';
      kind: 'garageCover' | 'playerIcon';
      filename: string;
      requestId: number;
    }
  | { type: 'preview:subscribe'; channel: ChannelName; rate?: number }
  | { type: 'preview:unsubscribe'; channel: ChannelName };

export type WidgetPreviewMessage =
  | { type: 'preview:telemetry'; telemetry: Telemetry }
  | { type: 'preview:asset'; requestId: number; dataUrl: string | null }
  | { type: 'preview:init'; config: WidgetPreviewConfig; session: Session }
  | { type: 'preview:config'; config: WidgetPreviewConfig }
  | {
      type: 'preview:snapshot';
      channel: ChannelName;
      payload: ChannelPayloads[ChannelName];
    };
