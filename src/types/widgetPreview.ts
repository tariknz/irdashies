import type { ChannelBridge, ChannelName, ChannelPayloads } from './channels';
import type { DashboardLayout } from './dashboardLayout';
import type { Session } from './session';
import type { Telemetry } from './telemetry';

/**
 * The reasons to stop a settings window's widget preview that only main can
 * see. The page stops its preview while either holds, unless Play was pressed
 * in the car, and starts a new one when they clear. Only the preview: the
 * Demo Mode that feeds the overlays is not affected.
 */
export interface WidgetPreviewStatus {
  /** The settings window is minimised or closed to the tray. */
  windowHidden: boolean;
  /** The player is in the car. */
  driving: boolean;
}

export const isWidgetPreviewStatus = (
  value: unknown
): value is WidgetPreviewStatus =>
  !!value &&
  typeof value === 'object' &&
  'windowHidden' in value &&
  typeof value.windowHidden === 'boolean' &&
  'driving' in value &&
  typeof value.driving === 'boolean';

/** A separate demo source; never changes the simulator feeding live overlays. */
export interface WidgetPreviewBridge extends ChannelBridge {
  connect(): Promise<Session>;
  disconnect(): Promise<void>;
  /** Only requested while the raw telemetry inspector is being previewed. */
  getTelemetry(): Promise<Telemetry | null>;
  /** Reports the current status at once, then every change to it. */
  onStatus(callback: (status: WidgetPreviewStatus) => void): () => void;
}

export const WIDGET_PREVIEW_IPC = {
  connect: 'widget-preview:connect',
  disconnect: 'widget-preview:disconnect',
  subscribe: 'widget-preview:subscribe',
  unsubscribe: 'widget-preview:unsubscribe',
  delivery: 'widget-preview:delivery',
  telemetry: 'widget-preview:telemetry',
  status: 'widget-preview:status',
} as const;

/** The per-window subscription that asks main for status updates. */
export const WIDGET_PREVIEW_STATUS_SUBSCRIPTION = 'widget-preview-status';

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
