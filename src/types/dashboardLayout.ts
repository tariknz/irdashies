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
  /** Unique instance ID of the widget. */
  id: string;
  /** Component type ID (e.g. 'fuel', 'standings'). If undefined, 'id' is used as type. */
  type?: string;
  /** Show/hide widget */
  enabled: boolean;
  /** When true, widget remains visible even when iRacing is not running. */
  alwaysEnabled?: boolean;
  /** The layout of the window for the widget on the dashboard. */
  layout: WidgetLayout;
  /** Configuration for the widget. */
  config?: Record<string, unknown>;
}

export type FontType = 'lato' | 'notosans' | 'figtree' | 'inter' | 'roboto';
export type FontSize =
  | 'xs'
  | 'sm'
  | 'md'
  | 'lg'
  | 'xl'
  | '2xl'
  | '3xl'
  | '4xl'
  | '5xl'
  | '6xl'
  | '7xl'
  | '8xl'
  | '9xl';

export interface GeneralSettingsType {
  fontType?: FontType;
  fontSize?: FontSize;
  fontWeight?:
    | 'light'
    | 'normal'
    | 'medium'
    | 'semibold'
    | 'bold'
    | 'extrabold';
  colorPalette?:
    | 'default'
    | 'black'
    | 'red'
    | 'orange'
    | 'amber'
    | 'yellow'
    | 'lime'
    | 'green'
    | 'emerald'
    | 'teal'
    | 'cyan'
    | 'sky'
    | 'blue'
    | 'indigo'
    | 'violet'
    | 'purple'
    | 'fuchsia'
    | 'pink'
    | 'rose'
    | 'zinc'
    | 'stone';
  showOnlyWhenOnTrack?: boolean;
  highlightColor?: number;
  skipTaskbar?: boolean;
  disableHardwareAcceleration?: boolean;
  enableAutoStart?: boolean;
  startMinimized?: boolean;
  compactMode?: boolean;
  overlayAlwaysOnTop?: boolean;
  enableNetworkAccess?: boolean;
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
  /** Optional theme settings that override dashboard general settings */
  themeSettings?: {
    fontType?: FontType;
    fontSize?: FontSize;
    colorPalette?: GeneralSettingsType['colorPalette'];
  };
}

export interface DashboardLayout {
  widgets: DashboardWidget[];
  generalSettings?: GeneralSettingsType;
}
