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

export interface GeneralSettingsType {
  fontSize?: 'xs' | 'sm' | 'lg' | 'xl';
  colorPalette?: 'default' | string;
}

export interface DashboardLayout {
  widgets: DashboardWidget[];
  generalSettings?: GeneralSettingsType;
}
