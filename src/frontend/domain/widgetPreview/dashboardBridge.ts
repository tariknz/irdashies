import type { DashboardBridge, DashboardLayout } from '@irdashies/types';

/** All mutations remain inside the preview, never reaching Electron or the sim. */
export function createPreviewDashboardBridge(
  initial: DashboardLayout,
  readAsset: (
    kind: 'garageCover' | 'playerIcon',
    filename: string
  ) => Promise<string | null> = async () => null
) {
  let dashboard = initial;
  const callbacks = new Set<(value: DashboardLayout) => void>();
  const profile = {
    id: 'preview',
    name: 'Preview',
    createdAt: '',
    lastModified: '',
  };
  const noop = () => undefined;
  const done = async () => undefined;
  const bridge: DashboardBridge = {
    dashboardUpdated: (callback) => {
      callbacks.add(callback);
      callback(dashboard);
      return () => callbacks.delete(callback);
    },
    reloadDashboard: noop,
    saveDashboard: noop,
    resetDashboard: async () => dashboard,
    onEditModeToggled: (callback) => {
      callback(false);
      return noop;
    },
    toggleLockOverlays: async () => false,
    getAppVersion: async () => '',
    toggleDemoMode: noop,
    onDemoModeChanged: (callback) => {
      callback(true);
      return noop;
    },
    getIsDemoMode: async () => true,
    getActiveSimulator: async () => null,
    getCurrentDashboard: () => dashboard,
    saveGarageCoverImage: async () => '',
    getGarageCoverImageAsDataUrl: (filename) =>
      readAsset('garageCover', filename),
    savePlayerIconImage: async () => '',
    getPlayerIconImageAsDataUrl: (filename) =>
      readAsset('playerIcon', filename),
    getAnalyticsOptOut: async () => true,
    setAnalyticsOptOut: done,
    listProfiles: async () => [profile],
    createProfile: async () => profile,
    cloneProfile: async () => profile,
    deleteProfile: done,
    renameProfile: done,
    switchProfile: done,
    getCurrentProfile: async () => profile,
    updateProfileTheme: done,
    getDashboardForProfile: async () => dashboard,
    exportDashboardToFile: async () => false,
    importDashboardFromFile: async () => null,
    openLogFolder: done,
    exportLogFile: async () => false,
    stop: noop,
    setAutoStart: done,
  };
  return {
    bridge,
    update: (value: DashboardLayout) => {
      dashboard = value;
      callbacks.forEach((callback) => callback(value));
    },
  };
}
