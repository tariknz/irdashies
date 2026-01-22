import type { DashboardLayout, DashboardProfile } from './dashboardLayout';

export interface SaveDashboardOptions {
  forceReload?: boolean;
  profileId?: string;
}

export interface DashboardBridge {
  onEditModeToggled: (callback: (value: boolean) => void) => void;
  dashboardUpdated: (callback: (dashboard: DashboardLayout, profileId: string) => void) => void;
  reloadDashboard: () => void;
  saveDashboard: (dashboard: DashboardLayout, options?: SaveDashboardOptions) => void;
  resetDashboard: (resetEverything: boolean) => Promise<DashboardLayout>;
  toggleLockOverlays: () => Promise<boolean>;
  getAppVersion: () => Promise<string>;
  toggleDemoMode: (value: boolean) => void;
  onDemoModeChanged: (callback: (value: boolean) => void) => void;
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
  updateProfileTheme: (profileId: string, themeSettings: DashboardProfile['themeSettings']) => Promise<void>;
  getDashboardForProfile: (profileId: string) => Promise<DashboardLayout | null>;
  stop: () => void;
  setAutoStart: (autoStart: boolean) => Promise<void>;
}
