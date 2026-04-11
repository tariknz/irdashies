import { type ReactNode, useMemo } from 'react';
import { SessionProvider, TelemetryProvider } from '@irdashies/context';
import { DashboardProvider } from '../../../src/frontend/context/DashboardContext/DashboardContext';
import { generateMockData } from '../../../src/app/bridge/iracingSdk/mock-data/generateMockData';
import type { DashboardBridge } from '@irdashies/types';
import { defaultDashboard } from '@irdashies/types';
import type { TypedDashboardWidget } from '@irdashies/types';

function createMockDashboardBridge(
  widgetOverrides?: TypedDashboardWidget[],
  onDashboardSaved?: (dashboard: typeof defaultDashboard) => void
): DashboardBridge {
  let dashboard = widgetOverrides
    ? { ...defaultDashboard, widgets: widgetOverrides }
    : { ...defaultDashboard };

  const dashboardCallbacks = new Set<
    (value: typeof dashboard, err: unknown) => void
  >();

  return {
    reloadDashboard: () => {
      /* noop */
    },
    saveDashboard: (updated) => {
      if (updated) {
        dashboard = updated as typeof dashboard;
        dashboardCallbacks.forEach((cb) => cb(dashboard, undefined));
        onDashboardSaved?.(dashboard);
      }
    },
    resetDashboard: async () => dashboard,
    dashboardUpdated: (callback) => {
      dashboardCallbacks.add(callback);
      callback(dashboard, undefined);
      return () => {
        dashboardCallbacks.delete(callback);
      };
    },
    onEditModeToggled: (callback) => {
      callback(false);
      return () => {
        /* noop */
      };
    },
    toggleLockOverlays: () => Promise.resolve(true),
    getAppVersion: () => Promise.resolve('0.2.0'),
    toggleDemoMode: () => {
      /* noop */
    },
    onDemoModeChanged: (callback) => {
      callback(true);
      return () => {
        /* noop */
      };
    },
    getCurrentDashboard: () => null,
    saveGarageCoverImage: () => Promise.resolve(''),
    getGarageCoverImageAsDataUrl: () => Promise.resolve(null),
    getAnalyticsOptOut: () => Promise.resolve(false),
    setAnalyticsOptOut: () => Promise.resolve(),
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
        id: 'mock',
        name,
        createdAt: new Date().toISOString(),
        lastModified: new Date().toISOString(),
      }),
    cloneProfile: () =>
      Promise.resolve({
        id: 'mock-clone',
        name: 'Clone',
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
}

interface LivePreviewProviderProps {
  children: ReactNode;
  widgets?: TypedDashboardWidget[];
  onDashboardSaved?: (dashboard: typeof defaultDashboard) => void;
}

export function LivePreviewProvider({
  children,
  widgets,
  onDashboardSaved,
}: LivePreviewProviderProps) {
  const bridge = useMemo(() => generateMockData(), []);
  const dashboardBridge = useMemo(
    () => createMockDashboardBridge(widgets, onDashboardSaved),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [widgets]
  );

  return (
    <>
      <SessionProvider bridge={bridge} />
      <TelemetryProvider bridge={bridge} />
      <DashboardProvider bridge={dashboardBridge}>{children}</DashboardProvider>
    </>
  );
}
