import './frontend/index.css';
import './frontend/theme.css';
import { createRoot } from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { DashboardView } from './frontend/components/DashboardView/DashboardView';
import { ThemeManager } from './frontend/components/ThemeManager/ThemeManager';
import {
  DashboardProvider,
  RunningStateProvider,
  SessionProvider,
  TelemetryProvider,
} from '@irdashies/context';
import type { DashboardBridge } from '@irdashies/types';

// Get profileId from URL params
const urlParams = new URLSearchParams(window.location.search);
const profileId = urlParams.get('profile') || undefined;
console.log('[DashboardView] URL profile parameter:', profileId);
const wsUrl = urlParams.get('wsUrl') || 'http://localhost:3000';
const debugMode = urlParams.get('debug') === 'true';

if (debugMode) {
  (window as Window & { __DEBUG_MODE__?: boolean }).__DEBUG_MODE__ = true;
}

async function initializeDashboardView() {
  const { WebSocketBridge } = await import('./app/webserver/componentRenderer');
  const bridge = new WebSocketBridge();

  await bridge.connect(wsUrl);

  const rootElement = document.getElementById('root');
  if (!rootElement) {
    throw new Error('Root element not found');
  }

  const root = createRoot(rootElement);

  root.render(
    <HashRouter>
      <TelemetryProvider bridge={bridge}>
        <SessionProvider bridge={bridge}>
          <RunningStateProvider bridge={bridge}>
            <DashboardProvider bridge={bridge as DashboardBridge} profileId={profileId}>
              <ThemeManager>
                <DashboardView />
              </ThemeManager>
            </DashboardProvider>
          </RunningStateProvider>
        </SessionProvider>
      </TelemetryProvider>
    </HashRouter>
  );
}

initializeDashboardView().catch(console.error);
