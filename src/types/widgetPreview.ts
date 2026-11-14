import type { ChannelBridge, ChannelName, ChannelPayloads } from './channels';
import type { DashboardLayout } from './dashboardLayout';
import type { Session } from './session';
import type { Telemetry } from './telemetry';

/**
 * Why the settings preview is held paused, whatever its own Pause button says.
 * Its demo is stopped while either is true and comes back once both clear.
 * Only the preview: the Demo Mode that feeds the overlays is not affected.
 */
export interface WidgetPreviewHold {
  /** The settings window is minimised or closed to the tray. */
  windowHidden: boolean;
  /** The player is in the car, so the demo would only compete with the sim. */
  driving: boolean;
}

export const isWidgetPreviewHold = (
  value: unknown
): value is WidgetPreviewHold =>
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
  /** Reports the current hold at once, then every change to it. */
  onHold(callback: (hold: WidgetPreviewHold) => void): () => void;
}

export const WIDGET_PREVIEW_IPC = {
  connect: 'widget-preview:connect',
  disconnect: 'widget-preview:disconnect',
  subscribe: 'widget-preview:subscribe',
  unsubscribe: 'widget-preview:unsubscribe',
  delivery: 'widget-preview:delivery',
  telemetry: 'widget-preview:telemetry',
  hold: 'widget-preview:hold',
} as const;

/** The per-window subscription that asks main for hold updates. */
export const WIDGET_PREVIEW_HOLD_SUBSCRIPTION = 'widget-preview-hold';

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
