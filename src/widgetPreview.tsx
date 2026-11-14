import './frontend/index.css';
import { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import {
  DashboardProvider,
  ReferenceStoreProvider,
  RunningStateProvider,
  SectorTimingUpdater,
  SessionTimingUpdater,
  useLapTraceRecorder,
  useSessionStore,
  useTelemetryStore,
} from '@irdashies/context';
import {
  channelRegistry,
  type IrSdkBridge,
  type LapTraceConfig,
  type Session,
  type TrackStateSnapshot,
} from '@irdashies/types';
import type {
  WidgetPreviewConfig,
  WidgetPreviewMessage,
  WidgetPreviewRequest,
} from './types/widgetPreview';
import { installAnimationGate } from '@irdashies/domain/widgetPreview/animationGate';
import { createPreviewFrameBridge } from '@irdashies/domain/widgetPreview/frameBridge';
import { createPreviewDashboardBridge } from '@irdashies/domain/widgetPreview/dashboardBridge';
import { createPreviewStorage } from '@irdashies/domain/widgetPreview/previewStorage';
import {
  previewDashboard,
  resolvePreviewWidget,
} from '@irdashies/domain/widgetPreview/presentation';
import { getWidget } from './frontend/WidgetIndex';
import { WidgetRuntimeProvider } from './frontend/widgetRuntime';
import { WidgetScale } from '@irdashies/domain/widgetPresentation/WidgetScale';
import { ThemeManager } from './frontend/components/ThemeManager/ThemeManager';
import { ErrorBoundary } from './frontend/components/ErrorBoundary/ErrorBoundary';
const GantryPreview = lazy(() =>
  import('./frontend/windows/GantryWindow').then((module) => ({
    default: module.GantryContent,
  }))
);

// Before any widget runs: while the host's demo is paused, the widgets'
// animation loops stop on their last picture instead of painting on.
const animation = installAnimationGate(window);

// This entry has no preload. Its only data source is its owning preview host.
const send = (request: WidgetPreviewRequest) =>
  window.parent.postMessage(request, '*');
const channels = createPreviewFrameBridge(send);
const source: IrSdkBridge = {
  onRunningState: (callback) => {
    callback(true);
    return () => undefined;
  },
  onSessionData: () => () => undefined,
  getRunningState: async () => true,
  stop: () => undefined,
};
window.channelBridge = channels.bridge;
const storage = createPreviewStorage();
window.fuelCalculatorBridge = storage.fuel;
window.lapTraceBridge = storage.lapTrace;
window.raceControlBridge = storage.raceControl;
const personalBests = new Map<string, number>();
window.personalBestBridge = {
  getPersonalBest: async (track, car) =>
    personalBests.get(`${track}:${car}`) ?? null,
  setPersonalBest: async (track, car, time) => {
    personalBests.set(`${track}:${car}`, time);
  },
};

// Widget UI preferences belong to this disposable frame, too.
const preferences = new Map<string, string>();
const memoryStorage: Storage = {
  get length() {
    return preferences.size;
  },
  clear: () => preferences.clear(),
  getItem: (key) => preferences.get(key) ?? null,
  key: (index) => [...preferences.keys()][index] ?? null,
  removeItem: (key) => preferences.delete(key),
  setItem: (key, value) => {
    preferences.set(key, value);
  },
};
Object.defineProperty(window, 'localStorage', {
  value: memoryStorage,
  configurable: true,
});

const element = document.getElementById('app');
if (!element) throw new Error('No preview root');
const root = createRoot(element);
let dashboard: ReturnType<typeof createPreviewDashboardBridge> | undefined;
let currentType: string | undefined;
let assetId = 0;
const assets = new Map<number, (dataUrl: string | null) => void>();
const readAsset = (kind: 'garageCover' | 'playerIcon', filename: string) =>
  new Promise<string | null>((resolve) => {
    const requestId = ++assetId;
    const timer = setTimeout(() => {
      assets.delete(requestId);
      resolve(null);
    }, 5000);
    assets.set(requestId, (dataUrl) => {
      clearTimeout(timer);
      assets.delete(requestId);
      resolve(dataUrl);
    });
    send({ type: 'preview:asset', kind, filename, requestId });
  });

const LapTraceRecorder = ({ config }: { config: LapTraceConfig }) => {
  useLapTraceRecorder(config.referenceSource ?? 'best');
  return null;
};

function renderPreview(config: WidgetPreviewConfig, session?: Session) {
  const widget = resolvePreviewWidget(config.dashboard, config.widgetId);
  if (!widget) return;
  const type = widget.type ?? widget.id;
  const Widget = getWidget(type);
  if (!Widget) return;
  currentType = type;
  const value = previewDashboard(config.dashboard, widget);
  if (!dashboard) {
    dashboard = createPreviewDashboardBridge(value, { readAsset });
    window.dashboardBridge = dashboard.bridge;
  } else dashboard.update(value);
  if (session) {
    useSessionStore.getState().setSession(session);
    storage.updateSession(session);
  }
  root.render(
    <DashboardProvider bridge={dashboard.bridge}>
      <RunningStateProvider bridge={source}>
        <ThemeManager>
          <WidgetRuntimeProvider widgetType={type}>
            <ReferenceStoreProvider bridge={channels.bridge} />
            <SessionTimingUpdater soloWidgetType={type} />
            <SectorTimingUpdater enabled={['map', 'flatmap'].includes(type)} />
            {type === 'laptrace' && (
              <LapTraceRecorder
                config={widget.config as unknown as LapTraceConfig}
              />
            )}
            <WidgetScale scale={widget.scale}>
              <ErrorBoundary
                label={`preview:${type}`}
                fallback={
                  <p className="p-4 text-sm text-slate-300">
                    This preview could not be displayed.
                  </p>
                }
              >
                <Suspense
                  fallback={
                    <p className="p-4 text-sm text-slate-400">
                      Loading widget…
                    </p>
                  }
                >
                  {type === 'gantry' ? (
                    <GantryPreview />
                  ) : (
                    <Widget {...value.widgets[0].config} />
                  )}
                </Suspense>
              </ErrorBoundary>
            </WidgetScale>
          </WidgetRuntimeProvider>
        </ThemeManager>
      </RunningStateProvider>
    </DashboardProvider>
  );
}

window.addEventListener('message', (event: MessageEvent<unknown>) => {
  if (
    event.source !== window.parent ||
    !event.data ||
    typeof event.data !== 'object' ||
    !('type' in event.data)
  )
    return;
  // The source is checked above; configuration and snapshots come from our host.
  const message = event.data as WidgetPreviewMessage;
  if (message.type === 'preview:telemetry')
    useTelemetryStore.getState().setTelemetry(message.telemetry);
  else if (message.type === 'preview:asset')
    assets.get(message.requestId)?.(message.dataUrl);
  else if (message.type === 'preview:init')
    renderPreview(message.config, message.session);
  else if (message.type === 'preview:config' && dashboard)
    renderPreview(message.config);
  else if (message.type === 'preview:pause') animation.pause();
  else if (message.type === 'preview:resume') animation.resume();
  else if (
    message.type === 'preview:snapshot' &&
    Object.hasOwn(channelRegistry, message.channel)
  ) {
    let payload = message.payload;
    if (
      currentType === 'garagecover' &&
      message.channel === 'track-state.snapshot'
    )
      payload = {
        ...(payload as TrackStateSnapshot),
        isOnTrack: false,
        isInGarage: true,
        isGarageVisible: true,
      };
    channels.receive(message.channel, payload);
  }
});
send({ type: 'preview:ready' });
