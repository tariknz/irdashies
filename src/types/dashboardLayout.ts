/**
 * Represents the layout of a widget on a dashboard.
 */
export interface WidgetLayout {
  /** The window x position of the widget. */
  x: number;
  /** The window y position of the widget. */
  y: number;
  /** The window width of the widget */
  width: number;
  /** The window height of the widget */
  height: number;
}

export interface DashboardWidget {
  /** id of the widget type, used to route to the widget (see App.tsx). */
  id: string;
  /** Show/hide widget */
  enabled: boolean;
  /** The layout of the window for the widget on the dashboard. */
  layout: WidgetLayout;
  /** Configuration for the widget. */
  config?: Record<string, unknown>;
}

export type FontSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';

export interface GeneralSettingsType {
  fontSize?: FontSize;
  fontWeight?:  'normal' | 'bold' | 'extrabold';
  colorPalette?: 'default' | 'black' | 'red' | 'orange' | 'amber' | 'yellow' | 'lime' | 'green' | 'emerald' | 'teal' | 'cyan' | 'sky' | 'blue' | 'indigo' | 'violet' | 'purple' | 'fuchsia' | 'pink' | 'rose' | 'zinc' | 'stone';
  showOnlyWhenOnTrack?: boolean;
  highlightColor?: number;
  skipTaskbar?: boolean;
  disableHardwareAcceleration?: boolean;
  enableAutoStart?: boolean;
  compactMode?: boolean;
  overlayAlwaysOnTop?: boolean;
  /** Driver tag groups and mappings for overlays */
  driverTagSettings?: DriverTagSettings;
}

export interface DashboardLayout {
  widgets: DashboardWidget[];
  generalSettings?: GeneralSettingsType;
}

export interface TagGroup {
  /** Unique id for the group */
  id: string;
  /** Display name for the group */
  name: string;
  /** Color represented as a 24-bit integer (e.g., 0xff0000) */
  color: number;
}

export interface DriverTagSettings {
  /** Array of user-created tag groups */
  groups: TagGroup[];
  /** Mapping from iRacing driver name (string) to group id */
  mapping: Record<string, string>;
  /** Display config for the tag strip */
  display: {
    enabled: boolean;
    /** Placement of the tag strip relative to elements */
    position: 'before-name' | 'after-name' | 'before-logo' | 'after-logo';
    /** Width in pixels for the vertical tag strip */
    widthPx: number;
  };
}
