import type { ChannelBridge, ChannelName, ChannelPayloads } from './channels';
import type { DashboardLayout } from './dashboardLayout';
import type { Session } from './session';
import type { Telemetry } from './telemetry';

/**
 * What main reports to a settings window about its widget preview.
 *
 * Main pauses the window's demo in place, so a resumed preview carries on
 * from where it stopped. It owns every reason to pause except the page's own
 * (its Pause button, and the page being hidden), which the page reports with
 * `setPaused`. Only the preview: the Demo Mode that feeds the overlays is not
 * affected.
 */
export interface WidgetPreviewStatus {
  /** The settings window is minimised or closed to the tray. */
  windowHidden: boolean;
  /** The player is in the car. */
  driving: boolean;
  /**
   * Play was pressed while the player was in the car: this widget's preview
   * runs until they get out. Another widget's preview arrives held again.
   */
  playInCar: boolean;
  /**
   * The window's connected demo is advancing. False while it is paused and
   * while no demo is connected. A demo connected while paused does not run
   * until it is let go, so it has no picture before then.
   */
  running: boolean;
}

export const isWidgetPreviewStatus = (
  value: unknown
): value is WidgetPreviewStatus =>
  !!value &&
  typeof value === 'object' &&
  'windowHidden' in value &&
  typeof value.windowHidden === 'boolean' &&
  'driving' in value &&
  typeof value.driving === 'boolean' &&
  'playInCar' in value &&
  typeof value.playInCar === 'boolean' &&
  'running' in value &&
  typeof value.running === 'boolean';

/** A separate demo source; never changes the simulator feeding live overlays. */
export interface WidgetPreviewBridge extends ChannelBridge {
  connect(): Promise<Session>;
  disconnect(): Promise<void>;
  /** Only requested while the raw telemetry inspector is being previewed. */
  getTelemetry(): Promise<Telemetry | null>;
  /** Reports the current status at once, then every change to it. */
  onStatus(callback: (status: WidgetPreviewStatus) => void): () => void;
  /**
   * The page's own reasons to pause: its Pause button, or the page being
   * hidden. Kept per window and applied to the demo connected next as well.
   */
  setPaused(paused: boolean): Promise<void>;
  /** Play pressed in the car. Main ignores it unless the player is in it. */
  playInCar(): Promise<void>;
}

export const WIDGET_PREVIEW_IPC = {
  connect: 'widget-preview:connect',
  disconnect: 'widget-preview:disconnect',
  subscribe: 'widget-preview:subscribe',
  unsubscribe: 'widget-preview:unsubscribe',
  delivery: 'widget-preview:delivery',
  telemetry: 'widget-preview:telemetry',
  status: 'widget-preview:status',
  setPaused: 'widget-preview:set-paused',
  playInCar: 'widget-preview:play-in-car',
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
    }
  /** The demo stopped: hold the frame's animation loops on its last picture. */
  | { type: 'preview:pause' }
  /** The demo is advancing again: let the held animation loops run. */
  | { type: 'preview:resume' };
