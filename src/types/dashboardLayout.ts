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
  /** The layout of the window for the widget on the dashboard. */
  layout: WidgetLayout;
  /** Configuration for the widget. */
  config?: Record<string, unknown>;
}

export interface TagGroup {
  /** Unique id for the group */
  id: string;
  /** Display name for the group */
  name: string;
  /** Color represented as a 24-bit integer (e.g., 0xff0000) */
  color: number;
  /** Optional custom icon (data URL or Phosphor icon name string) */
  icon?: string;
}

export interface DriverTagEntry {
  /** iRacing customer ID (numeric string) — primary lookup key */
  id?: string;
  /** iRacing display name — fallback lookup key */
  name?: string;
  /** Custom display label shown on the badge/tag */
  label?: string;
  /** The tag group id this driver belongs to */
  groupId: string;
}

export interface DriverTagSettings {
  /** Array of user-created tag groups */
  groups: TagGroup[];
  /** Driver tag entries (preferred over legacy mapping) */
  entries?: DriverTagEntry[];
  /** @deprecated Use entries instead */
  mapping: Record<string, string>;
  /** Display config for the tag */
  display: {
    enabled: boolean;
    /** Width in pixels for the tag/badge */
    widthPx: number;
    /** 'badge' shows an icon, 'tag' shows a colored pill */
    displayStyle?: 'badge' | 'tag';
    /** Phosphor icon weight: 'regular' (outline) or 'fill' */
    iconWeight?: 'regular' | 'fill';
    /** What to show in driver name cell when a label is set */
    nameDisplay?: 'both' | 'label' | 'name';
    /** Seconds between name/label alternation (2–60, default 5) */
    alternateFrequency?: number;
  };
  /** Optional per-preset overrides (preset id → partial TagGroup) */
  presetOverrides?: Record<string, Partial<TagGroup>>;
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
  /** Driver tag groups and mappings for overlays */
  driverTagSettings?: DriverTagSettings;
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
