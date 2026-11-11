import { type ReactNode, useMemo, useRef, useLayoutEffect } from 'react';
import {
  SessionProvider,
  StoryTelemetryProvider,
  RunningStateProvider,
  DashboardProvider,
} from '@irdashies/context';
import { generateMockData } from '../../../src/app/bridge/iracingSdk/mock-data/generateMockData';
import type { DashboardLayout, IrSdkSourceBridge } from '@irdashies/types';
import { defaultDashboard } from '@irdashies/types';
import type { TypedDashboardWidget } from '@irdashies/types';
import {
  createPreviewChannelRuntime,
  shieldSourceFromStop,
  type PreviewChannelRuntime,
} from './previewChannelRuntime';
import { createPreviewStorage } from './previewStorage';
import { createPreviewDashboardBridge } from '@irdashies/domain/widgetPreview/dashboardBridge';

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
let stopStorageSession: (() => void) | undefined;

function getPreviewSource(): IrSdkSourceBridge {
  if (!previewSource) {
    const storage = createPreviewStorage();
    window.fuelCalculatorBridge = storage.fuel;
    window.lapTraceBridge = storage.lapTrace;
    window.raceControlBridge = storage.raceControl;
    rawSource = generateMockData();
    const source = rawSource;
    previewSource = shieldSourceFromStop(source);
    stopStorageSession = previewSource.onSessionData(storage.updateSession);
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
    stopStorageSession?.();
    rawSource?.stop();
  });
}

interface LivePreviewProviderProps {
  children: ReactNode;
  widgets?: TypedDashboardWidget[];
  onDashboardSaved?: (dashboard: DashboardLayout) => void;
}

export function LivePreviewProvider({
  children,
  widgets,
  onDashboardSaved,
}: LivePreviewProviderProps) {
  const bridge = useMemo(() => getPreviewSource(), []);
  const onSavedRef = useRef(onDashboardSaved);
  useLayoutEffect(() => {
    onSavedRef.current = onDashboardSaved;
  }, [onDashboardSaved]);
  const dashboardBridge = useMemo(
    () =>
      createPreviewDashboardBridge(
        widgets ? { ...defaultDashboard, widgets } : defaultDashboard,
        { onSave: (value) => onSavedRef.current?.(value) }
      ).bridge,
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
