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
  colorPalette?: 'default' | 'black' | 'red' | 'orange' | 'amber' | 'yellow' | 'lime' | 'green' | 'emerald' | 'teal' | 'cyan' | 'sky' | 'blue' | 'indigo' | 'violet' | 'purple' | 'fuchsia' | 'pink' | 'rose' | 'zinc' | 'stone';
  showOnlyWhenOnTrack?: boolean;
  highlightColor?: number;
  skipTaskbar?: boolean;
  disableHardwareAcceleration?: boolean;
}

/**
 * Represents a configuration profile with a unique identifier and name.
 */
export interface DashboardProfile {
  /** Unique identifier for the profile */
  id: string;
  /** User-friendly name for the profile */
  name: string;
  /** ISO timestamp of when the profile was created */
  createdAt?: string;
  /** ISO timestamp of when the profile was last modified */
  lastModified?: string;
}

export interface DashboardLayout {
  widgets: DashboardWidget[];
  generalSettings?: GeneralSettingsType;
}
