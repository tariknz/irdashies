import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import {
  TelemetryProvider,
  DashboardProvider,
  useDashboard,
  RunningStateProvider,
  useRunningState,
  SessionProvider,
} from '@irdashies/context';
import { Settings } from './components/Settings/Settings';
import { EditMode } from './components/EditMode/EditMode';
import { ThemeManager } from './components/ThemeManager/ThemeManager';
import { WIDGET_MAP } from './WidgetIndex';

const AppRoutes = () => {
  const { currentDashboard } = useDashboard();
  const { running } = useRunningState();

  return (
    <Routes>
      {currentDashboard?.widgets.map((widget) => {
        const WidgetComponent = WIDGET_MAP[widget.id];
        if (!WidgetComponent) {
          return null;
        }

        return (
          <Route
            key={widget.id}
            path={`/${widget.id}`}
            element={
              running ? (
                <WidgetComponent {...widget.config} />
              ) : (
                <></>
              )
            }
          />
        );
      })}
      <Route path="/settings/*" element={<Settings />} />
    </Routes>
  );
};

declare global {
  interface Window {
    globalKey?: {
      onToggle: (cb: (hide: boolean) => void) => () => void;
    };
  }
}

const App = () => {
  const [hideUI, setHideUI] = useState(false);

  useEffect(() => {
    if (window.globalKey?.onToggle) {
      const unsub = window.globalKey.onToggle((hide) => setHideUI(hide));
      return () => unsub();
    }
  }, []);

  return (
    <div className={hideUI ? 'hidden-ui' : ''}>
      <DashboardProvider bridge={window.dashboardBridge}>
        <RunningStateProvider bridge={window.irsdkBridge}>
          <SessionProvider bridge={window.irsdkBridge} />
          <TelemetryProvider bridge={window.irsdkBridge} />
          <HashRouter>
            <EditMode>
              <ThemeManager>
                <AppRoutes />
              </ThemeManager>
            </EditMode>
          </HashRouter>
        </RunningStateProvider>
      </DashboardProvider>
    </div>
  );
};

const el = document.getElementById('app');
if (!el) {
  throw new Error('No #app element found');
}

export default App;

const root = createRoot(el);
root.render(<App />);
