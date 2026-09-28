import type { DashboardBridge } from '@irdashies/types';
import { defaultDashboard } from '@irdashies/types';

/**
 * Demo mode is a bridge-level state, so a story that needs it sets the flag
 * here before mounting. A capture story and a demo story cannot both apply,
 * which is the point: demo mode has no telemetry, so driving it from a
 * recording would say nothing about demo mode.
 */
export const mockDashboardBridgeState = {
  isDemoMode: false,
};

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
    callback(defaultDashboard, undefined);
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
    callback(mockDashboardBridgeState.isDemoMode);
    return () => {
      return;
    };
  },
  getCurrentDashboard: () => {
    return null;
  },
  saveGarageCoverImage: () => Promise.resolve(''),
  getGarageCoverImageAsDataUrl: () => Promise.resolve(null),
  savePlayerIconImage: () => Promise.resolve(''),
  getPlayerIconImageAsDataUrl: () => Promise.resolve(null),
  getAnalyticsOptOut: () => Promise.resolve(false),
  setAnalyticsOptOut: () => Promise.resolve(),
  // Profile management mocks
  listProfiles: () =>
    Promise.resolve([
      {
        id: 'default',
        name: 'Default',
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
      },
    ]),
  createProfile: (name: string) =>
    Promise.resolve({
      id: 'mock-id',
      name,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    }),
  cloneProfile: (profileId: string) =>
    Promise.resolve({
      id: 'mock-clone-id',
      name: `${profileId} - cloned`,
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    }),
  deleteProfile: () => Promise.resolve(),
  renameProfile: () => Promise.resolve(),
  switchProfile: () => Promise.resolve(),
  getCurrentProfile: () =>
    Promise.resolve({
      id: 'default',
      name: 'Default',
      createdAt: new Date().toISOString(),
      lastModified: new Date().toISOString(),
    }),
  updateProfileTheme: async () => undefined,
  getDashboardForProfile: async () => null,
  exportDashboardToFile: async () => false,
  importDashboardFromFile: async () => null,
  stop: () => undefined,
  setAutoStart: () => Promise.resolve(),
  openLogFolder: async () => undefined,
  exportLogFile: async () => false,
};
