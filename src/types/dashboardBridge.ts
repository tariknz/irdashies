import type { DashboardLayout } from './dashboardLayout';
import { waitForOptions } from '@testing-library/react';

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
  toggleDemoMode: (value: boolean) => void;
  onDemoModeChanged: (callback: (value: boolean) => void) => void;
  getCurrentDashboard: () => DashboardLayout | null;
  saveGarageCoverImage: (buffer: Uint8Array) => Promise<string>;
  getGarageCoverImageAsDataUrl: (imagePath: string) => Promise<string | null>;
  getAnalyticsOptOut: () => Promise<boolean>;
  setAnalyticsOptOut: (optOut: boolean) => Promise<void>;
  stop: () => void;
  setAutoStart: (autoStart: boolean) => Promise<void>;
}
