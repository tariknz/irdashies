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
  saveGarageCoverImage: () => Promise.resolve(''),
  getGarageCoverImageAsDataUrl: () => Promise.resolve(null),
  getAnalyticsOptOut: () => Promise.resolve(false),
  setAnalyticsOptOut: () => Promise.resolve(),
  // Profile management mocks
  listProfiles: () => Promise.resolve([
    { id: 'default', name: 'Default', createdAt: new Date().toISOString(), lastModified: new Date().toISOString() }
  ]),
  createProfile: (name: string) => Promise.resolve({
    id: 'mock-id',
    name,
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString()
  }),
  deleteProfile: () => Promise.resolve(),
  renameProfile: () => Promise.resolve(),
  switchProfile: () => Promise.resolve(),
  getCurrentProfile: () => Promise.resolve({
    id: 'default',
    name: 'Default',
    createdAt: new Date().toISOString(),
    lastModified: new Date().toISOString()
  }),
  updateProfileTheme: async () => undefined,
  getDashboardForProfile: async () => null,
  stop: () => undefined,
  setAutoStart:() => Promise.resolve()
}; 