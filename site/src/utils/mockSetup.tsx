import { type ReactNode, useMemo } from 'react';
import {
  SessionProvider,
  StoryTelemetryProvider,
  RunningStateProvider,
  DashboardProvider,
} from '@irdashies/context';
import { generateMockData } from '../../../src/app/bridge/iracingSdk/mock-data/generateMockData';
import type { DashboardBridge, IrSdkSourceBridge } from '@irdashies/types';
import { defaultDashboard } from '@irdashies/types';
import type { TypedDashboardWidget } from '@irdashies/types';
import {
  createPreviewChannelRuntime,
  shieldSourceFromStop,
  type PreviewChannelRuntime,
} from './previewChannelRuntime';

/**
 * The mock SDK source and the channel runtime built on it are page-lifetime
 * singletons rather than component state.
 *
 * Widgets read `window.channelBridge` while they mount, so the bridge has to
 * exist before any child renders — and there is exactly one preview per page,
 * which never unmounts. Keeping them at module scope means StrictMode's
 * double-invoked render and simulated remount can't produce a second SDK
 * ticker or leave widgets pointing at a disposed bridge.
 */
let previewSource: IrSdkSourceBridge | undefined;
let previewRuntime: PreviewChannelRuntime | undefined;
let rawSource: IrSdkSourceBridge | undefined;

function getPreviewSource(): IrSdkSourceBridge {
  if (!previewSource) {
    rawSource = generateMockData();
    previewSource = shieldSourceFromStop(rawSource);
    previewRuntime = createPreviewChannelRuntime(previewSource);
    window.channelBridge = previewRuntime.bridge;
  }
  return previewSource;
}

// Vite Fast Refresh re-evaluates this module on edit, resetting the
// singletons above. Without an HMR dispose hook the replaced runtime keeps
// running forever — its stop() is deliberately shielded from consumers and
// the dispose handle would be gone — stacking an extra 60Hz ticker and
// ProcessorHost per edit during site development.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    previewRuntime?.dispose();
    rawSource?.stop();
  });
}

function createMockDashboardBridge(
  widgetOverrides?: TypedDashboardWidget[],
  onDashboardSaved?: (dashboard: typeof defaultDashboard) => void
): DashboardBridge {
  let dashboard = widgetOverrides
    ? { ...defaultDashboard, widgets: widgetOverrides }
    : { ...defaultDashboard };

  const dashboardCallbacks = new Set<
    (value: typeof dashboard, profileId?: string) => void
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
    savePlayerIconImage: () => Promise.resolve(''),
    getPlayerIconImageAsDataUrl: () => Promise.resolve(null),
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
  const bridge = useMemo(() => getPreviewSource(), []);
  const dashboardBridge = useMemo(
    () => createMockDashboardBridge(widgets, onDashboardSaved),
    // eslint-disable-next-line @eslint-react/exhaustive-deps
    [widgets]
  );

  return (
    <DashboardProvider bridge={dashboardBridge}>
      <RunningStateProvider bridge={bridge}>
        <SessionProvider bridge={bridge} />
        <StoryTelemetryProvider bridge={bridge} />
        {children}
      </RunningStateProvider>
    </DashboardProvider>
  );
}
