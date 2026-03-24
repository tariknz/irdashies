// App.tsx
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import {
  TelemetryProvider,
  DashboardProvider,
  RunningStateProvider,
  SessionProvider,
  PitLaneProvider,
  ReferenceStoreProvider,
} from '@irdashies/context';
import { Settings } from './components/Settings/Settings';
import { ThemeManager } from './components/ThemeManager/ThemeManager';
import { HideUIWrapper } from './components/HideUIWrapper/HideUIWrapper';
import { OverlayContainer } from './components/OverlayContainer';
import { Gantry } from './components/Gantry/Gantry';

/**
 * Check if this window is the settings window based on URL hash
 */
const isSettingsWindow = () => {
  return window.location.hash.startsWith('#/settings');
};

/**
 * Check if this window is the gantry window based on URL hash
 */
const isGantryWindow = () => {
  return window.location.hash.startsWith('#/gantry');
};

/**
 * Settings window content - uses HashRouter for settings routes
 */
const SettingsApp = () => {
  return (
    <HashRouter>
      <Routes>
        <Route path="/settings/*" element={<Settings />} />
      </Routes>
    </HashRouter>
  );
};

/**
 * Gantry window content - renders Gantry in a dedicated framed window
 */
const GantryApp = () => (
  <ThemeManager>
    <div className="w-full h-full bg-slate-900 text-white">
      <Gantry />
    </div>
  </ThemeManager>
);

/**
 * Overlay container content - renders all widgets in a single window
 */
const OverlayApp = () => {
  return (
    <HideUIWrapper>
      <ThemeManager>
        <OverlayContainer />
      </ThemeManager>
    </HideUIWrapper>
  );
};

const App = () => {
  if (isGantryWindow()) {
    return (
      <DashboardProvider bridge={window.dashboardBridge}>
        <RunningStateProvider bridge={window.irsdkBridge}>
          <SessionProvider bridge={window.irsdkBridge} />
          <TelemetryProvider bridge={window.irsdkBridge} />
          <GantryApp />
        </RunningStateProvider>
      </DashboardProvider>
    );
  }

  const isSettings = isSettingsWindow();

  if (isSettings) {
    return (
      <DashboardProvider bridge={window.dashboardBridge}>
        <SettingsApp />
      </DashboardProvider>
    );
  }

  return (
    <DashboardProvider bridge={window.dashboardBridge}>
      <RunningStateProvider bridge={window.irsdkBridge}>
        <SessionProvider bridge={window.irsdkBridge} />
        <TelemetryProvider bridge={window.irsdkBridge} />
        <PitLaneProvider bridge={window.pitLaneBridge} />
        <ReferenceStoreProvider bridge={window.referenceLapsBridge} />
        <OverlayApp />
      </RunningStateProvider>
    </DashboardProvider>
  );
};

const el = document.getElementById('app');
if (!el) {
  throw new Error('No #app element found');
}

export default App;

const root = createRoot(el);
root.render(<App />);
