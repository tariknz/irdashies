// App.tsx
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import {
  DashboardProvider,
  RunningStateProvider,
  SessionProvider,
  useRunningState,
  useResetOnDisconnect,
  LapGapStoreUpdater,
} from '@irdashies/context';
import { Settings } from './components/Settings/Settings';
import { ThemeManager } from './components/ThemeManager/ThemeManager';
import { HideUIWrapper } from './components/HideUIWrapper/HideUIWrapper';
import { ProfileSwitchOverlay } from './components/ProfileSwitchOverlay/ProfileSwitchOverlay';
import { OverlayContainer } from './components/OverlayContainer';
import { ErrorBoundary } from './components/ErrorBoundary/ErrorBoundary';
import { RendererDataProviders } from './components/RendererDataProviders/RendererDataProviders';
import { WidgetRuntimeProvider } from './widgetRuntime';
import { Gantry } from './components/Gantry/Gantry';

/**
 * Check if this window is the settings window based on URL hash
 */
const isSettingsWindow = () => {
  return window.location.hash.startsWith('#/settings');
};

/**
 * Check if this window is the Gantry race-control window based on URL hash
 */
const isGantryWindow = () => {
  return window.location.hash.startsWith('#/gantry');
};

/**
 * Settings window content - uses HashRouter for settings routes
 */
const SettingsApp = () => {
  return (
    <>
      <SessionProvider bridge={window.irsdkBridge} />
      <HashRouter>
        <Routes>
          <Route path="/settings/*" element={<Settings />} />
        </Routes>
      </HashRouter>
    </>
  );
};

/**
 * Gantry window content - a framed, interactive race-control window.
 * Unlike the overlay it is not click-through, so it does not use
 * HideUIWrapper (whose global hide targets transparent overlays).
 */
const GantryApp = () => {
  const { running } = useRunningState();
  useResetOnDisconnect(running);
  return (
    // The runtime provider supplies Gantry's declared channel rates; without
    // it every channel hook here would fall back to the unthrottled default.
    <WidgetRuntimeProvider widgetType="gantry">
      <ThemeManager>
        <LapGapStoreUpdater enabled={running} />
        <div className="w-full h-full bg-slate-900 text-white">
          <Gantry />
        </div>
      </ThemeManager>
    </WidgetRuntimeProvider>
  );
};

/**
 * Overlay container content - renders all widgets in a single window
 */
const OverlayApp = () => {
  return (
    <HideUIWrapper>
      <ProfileSwitchOverlay>
        <ThemeManager>
          <OverlayContainer />
        </ThemeManager>
      </ProfileSwitchOverlay>
    </HideUIWrapper>
  );
};

const App = () => {
  if (isGantryWindow()) {
    return (
      <ErrorBoundary label="gantry" resetAfterMs={2000}>
        <DashboardProvider bridge={window.dashboardBridge}>
          <RunningStateProvider bridge={window.irsdkBridge}>
            <SessionProvider bridge={window.irsdkBridge} />
            {/* Per-car data comes from typed channels, which subscribe
                through window.channelBridge and need no provider. */}
            <GantryApp />
          </RunningStateProvider>
        </DashboardProvider>
      </ErrorBoundary>
    );
  }

  const isSettings = isSettingsWindow();

  if (isSettings) {
    return (
      <ErrorBoundary label="settings" resetAfterMs={2000}>
        <DashboardProvider bridge={window.dashboardBridge}>
          <SettingsApp />
        </DashboardProvider>
      </ErrorBoundary>
    );
  }

  return (
    <ErrorBoundary label="overlay" resetAfterMs={2000}>
      <DashboardProvider bridge={window.dashboardBridge}>
        <RunningStateProvider bridge={window.irsdkBridge}>
          <RendererDataProviders />
          <OverlayApp />
        </RunningStateProvider>
      </DashboardProvider>
    </ErrorBoundary>
  );
};

const el = document.getElementById('app');
if (!el) {
  throw new Error('No #app element found');
}

export default App;

const root = createRoot(el);
root.render(<App />);
