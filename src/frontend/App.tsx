// App.tsx
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import {
  TelemetryProvider,
  DashboardProvider,
  RunningStateProvider,
  SessionProvider,
  PitLaneProvider,
} from '@irdashies/context';
import { Settings } from './components/Settings/Settings';
import { ThemeManager } from './components/ThemeManager/ThemeManager';
import { HideUIWrapper } from './components/HideUIWrapper/HideUIWrapper';
import { OverlayContainer } from './components/OverlayContainer';
import { TitleBar } from './components/TitleBar/TitleBar';

/**
 * Check if this window is the settings window based on URL hash
 */
const isSettingsWindow = () => {
  return window.location.hash.startsWith('#/settings');
};

/**
 * Settings window content - uses HashRouter for settings routes
 */
const SettingsApp = () => {
  return (
    <div className="flex flex-col h-full bg-slate-950">
      <div className="m-3">
        <TitleBar />
      </div>
      <div className="flex-1 min-h-0 mx-3 mb-3">
        <HashRouter>
          <Routes>
            <Route path="/settings/*" element={<Settings />} />
          </Routes>
        </HashRouter>
      </div>
    </div>
  );
};

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
  const isSettings = isSettingsWindow();

  return (
    <DashboardProvider bridge={window.dashboardBridge}>
      <RunningStateProvider bridge={window.irsdkBridge}>
        <SessionProvider bridge={window.irsdkBridge} />
        <TelemetryProvider bridge={window.irsdkBridge} />
        <PitLaneProvider bridge={window.pitLaneBridge} />
        {isSettings ? <SettingsApp /> : <OverlayApp />}
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
