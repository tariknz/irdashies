import './frontend/index.css';
import './frontend/theme.css';
import logger from './frontend/utils/logger';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { DashboardView } from './frontend/components/DashboardView/DashboardView';
import { ThemeManager } from './frontend/components/ThemeManager/ThemeManager';
import { DashboardProvider, RunningStateProvider } from '@irdashies/context';
import type { DashboardBridge, FuelCalculatorBridge } from '@irdashies/types';
import { RendererDataProviders } from './frontend/components/RendererDataProviders/RendererDataProviders';

// Get profileId from URL params
const urlParams = new URLSearchParams(window.location.search);
const profileId = urlParams.get('profile') || undefined;
logger.info('[DashboardView] URL profile parameter:', profileId);
const wsUrl = urlParams.get('wsUrl') || 'http://localhost:3000';
const debugMode = urlParams.get('debug') === 'true';

if (debugMode) {
  (window as Window & { __DEBUG_MODE__?: boolean }).__DEBUG_MODE__ = true;
}

async function initializeDashboardView() {
  const { WebSocketBridge } = await import('./app/webserver/componentRenderer');
  const bridge = new WebSocketBridge();

  await bridge.connect(wsUrl);
  window.irsdkBridge = bridge;
  window.channelBridge = bridge;
  window.telemetryInspectorBridge = bridge;
  window.fuelCalculatorBridge = {
    getHistoricalLaps: async () => [],
    saveLap: async () => undefined,
    clearHistory: async () => undefined,
    clearAllHistory: async () => undefined,
    getQualifyMax: async () => null,
    saveQualifyMax: async () => undefined,
    startNewLog: async () => undefined,
    logData: async () => undefined,
  } satisfies FuelCalculatorBridge;

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  const root = createRoot(rootElement);

  root.render(
    <HashRouter>
      <DashboardProvider
        bridge={bridge as DashboardBridge}
        profileId={profileId}
      >
        <RunningStateProvider bridge={bridge}>
          <RendererDataProviders browser />
          <ThemeManager>
            <DashboardView />
          </ThemeManager>
        </RunningStateProvider>
      </DashboardProvider>
    </HashRouter>
  );
}

initializeDashboardView().catch(logger.error);
