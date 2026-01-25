import type { DashboardBridge } from '@irdashies/types';
import { defaultDashboard } from '../src/app/storage/defaultDashboard';

export const mockDashboardBridge: DashboardBridge = {
  reloadDashboard: () => {
    // noop
  },
  saveDashboard: () => {
    // noop
  },
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  resetDashboard: async (_resetEverything: boolean) => {
    // For mock, just return the default dashboard
    return defaultDashboard;
  },
  dashboardUpdated: (callback) => {
    callback(defaultDashboard);
    return () => {
      // noop
    };
  },
  onEditModeToggled: (callback) => {
    callback(false);
    return () => {
      // noop
    };
  },
  toggleLockOverlays: () => Promise.resolve(true),
  getAppVersion: () => Promise.resolve('0.0.7+mock'),
  toggleDemoMode: () => {
    return;
  },
  onDemoModeChanged: (callback) => {
    callback(false);
    return () => {
      return;
    };
  },
  getCurrentDashboard: () => {
    return null;
  },
  stop: () => {
    return;
  },
  saveGarageCoverImage: () => Promise.resolve(''),
  getGarageCoverImageAsDataUrl: () => Promise.resolve(null),
  getAnalyticsOptOut: () => Promise.resolve(false),
  setAnalyticsOptOut: () => Promise.resolve(),
  setAutoStart:() => Promise.resolve()
};
