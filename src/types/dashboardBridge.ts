import type { DashboardLayout } from './dashboardLayout';

export interface SaveDashboardOptions {
  forceReload?: boolean;
  /** Skip window refresh - used for layout-only changes in container mode */
  skipWindowRefresh?: boolean;
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
}

export interface DashboardBridge {
  onEditModeToggled: (callback: (value: boolean) => void) => (() => void) | undefined;
  dashboardUpdated: (callback: (value: DashboardLayout) => void) => (() => void) | undefined;
  reloadDashboard: () => void;
  saveDashboard: (dashboard: DashboardLayout, options?: SaveDashboardOptions) => void;
  resetDashboard: (resetEverything: boolean) => Promise<DashboardLayout>;
  toggleLockOverlays: () => Promise<boolean>;
  getAppVersion: () => Promise<string>;
  toggleDemoMode: (value: boolean) => void;
  onDemoModeChanged: (callback: (value: boolean) => void) => (() => void) | undefined;
  getCurrentDashboard: () => DashboardLayout | null;
  saveGarageCoverImage: (buffer: Uint8Array) => Promise<string>;
  getGarageCoverImageAsDataUrl: (imagePath: string) => Promise<string | null>;
  getAnalyticsOptOut: () => Promise<boolean>;
  setAnalyticsOptOut: (optOut: boolean) => Promise<void>;
  stop: () => void;
  setAutoStart: (autoStart: boolean) => Promise<void>;
  onContainerBoundsInfo?: (
    callback: (value: ContainerBoundsInfo) => void
  ) => (() => void) | undefined;
}
