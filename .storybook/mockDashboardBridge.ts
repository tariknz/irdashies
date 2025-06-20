import type { DashboardBridge } from '@irdashies/types';
import { defaultDashboard } from '../src/app/storage/defaultDashboard';

export const mockDashboardBridge: DashboardBridge = {
  reloadDashboard: () => {
    // noop
  },
  saveDashboard: () => {
    // noop
  },
  resetDashboard: async () => {
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
}; 