import type { DashboardLayout } from './dashboardLayout';

export interface SaveDashboardOptions {
  forceReload?: boolean;
}

export interface DashboardBridge {
  onEditModeToggled: (callback: (value: boolean) => void) => void;
  dashboardUpdated: (callback: (value: DashboardLayout) => void) => void;
  reloadDashboard: () => void;
  saveDashboard: (dashboard: DashboardLayout, options?: SaveDashboardOptions) => void;
  resetDashboard: (resetEverything: boolean) => Promise<DashboardLayout>;
  toggleLockOverlays: () => Promise<boolean>;
  getAppVersion: () => Promise<string>;
  toggleDemoMode?: (value: boolean) => void;
  onDemoModeChanged?: (callback: (value: boolean) => void) => void;
}
