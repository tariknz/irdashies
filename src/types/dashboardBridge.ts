import type { DashboardLayout, DashboardProfile } from './dashboardLayout';

export interface SaveDashboardOptions {
  forceReload?: boolean;
  /** Skip window refresh - used for layout-only changes in container mode */
  skipWindowRefresh?: boolean;
  profileId?: string;
}

/**
 * Information about the container window bounds
 * Used to compensate for OS constraints on window positioning
 */
export interface ContainerBoundsInfo {
  /** The bounds we requested */
  expected: { x: number; y: number; width: number; height: number };
  /** The bounds the OS actually gave us (may differ due to constraints) */
  actual: { x: number; y: number; width: number; height: number };
  /** Offset to compensate for OS constraints (actual - expected) */
  offset: { x: number; y: number };
  /** Which display this window belongs to */
  displayId?: number;
  /** True for the primary display window */
  isPrimary?: boolean;
}

export interface DashboardBridge {
  onEditModeToggled: (
    callback: (value: boolean) => void
  ) => (() => void) | undefined;
  dashboardUpdated: (
    callback: (dashboard: DashboardLayout, profileId?: string) => void
  ) => (() => void) | undefined;
  reloadDashboard: () => void;
  saveDashboard: (
    dashboard: DashboardLayout,
    options?: SaveDashboardOptions
  ) => void;
  resetDashboard: (resetEverything: boolean) => Promise<DashboardLayout>;
  toggleLockOverlays: () => Promise<boolean>;
  getAppVersion: () => Promise<string>;
  toggleDemoMode: (value: boolean) => void;
  onDemoModeChanged: (
    callback: (value: boolean) => void
  ) => (() => void) | undefined;
  getCurrentDashboard: () => DashboardLayout | null;
  saveGarageCoverImage: (buffer: Uint8Array) => Promise<string>;
  getGarageCoverImageAsDataUrl: (imagePath: string) => Promise<string | null>;
  getAnalyticsOptOut: () => Promise<boolean>;
  setAnalyticsOptOut: (optOut: boolean) => Promise<void>;
  listProfiles: () => Promise<DashboardProfile[]>;
  createProfile: (name: string) => Promise<DashboardProfile>;
  deleteProfile: (profileId: string) => Promise<void>;
  renameProfile: (profileId: string, newName: string) => Promise<void>;
  switchProfile: (profileId: string) => Promise<void>;
  getCurrentProfile: () => Promise<DashboardProfile | null>;
  updateProfileTheme: (
    profileId: string,
    themeSettings: DashboardProfile['themeSettings']
  ) => Promise<void>;
  getDashboardForProfile: (
    profileId: string
  ) => Promise<DashboardLayout | null>;
  stop: () => void;
  setAutoStart: (autoStart: boolean) => Promise<void>;
  onContainerBoundsInfo?: (
    callback: (value: ContainerBoundsInfo) => void
  ) => (() => void) | undefined;
}
