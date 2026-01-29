// App.tsx
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import {
  TelemetryProvider,
  DashboardProvider,
  RunningStateProvider,
  useRunningState,
  SessionProvider,
  PitLaneProvider,
  useResetOnDisconnect,
} from '@irdashies/context';
import { Settings } from './components/Settings/Settings';
import { EditMode } from './components/EditMode/EditMode';
import { ThemeManager } from './components/ThemeManager/ThemeManager';
import { WIDGET_MAP } from './WidgetIndex';
import { HideUIWrapper } from './components/HideUIWrapper/HideUIWrapper';

const AppRoutes = () => {
  const { running } = useRunningState();
  useResetOnDisconnect(running);

  return (
    <Routes>
      {Object.entries(WIDGET_MAP).map(([widgetId, WidgetComponent]) => (
        <Route
          key={widgetId}
          path={`/${widgetId}`}
          element={running ? <WidgetComponent /> : <></>}
        />
      ))}
      <Route path="/settings/*" element={<Settings />} />
    </Routes>
  );
};

const App = () => {
  return (
    <DashboardProvider bridge={window.dashboardBridge}>
      <RunningStateProvider bridge={window.irsdkBridge}>
        <SessionProvider bridge={window.irsdkBridge} />
        <TelemetryProvider bridge={window.irsdkBridge} />
        <PitLaneProvider bridge={window.pitLaneBridge} />
        <HashRouter>
          <HideUIWrapper>
            <EditMode>
              <ThemeManager>
                <AppRoutes />
              </ThemeManager>
            </EditMode>
          </HideUIWrapper>
        </HashRouter>
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
