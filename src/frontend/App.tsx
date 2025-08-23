import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import {
  TelemetryProvider,
  DashboardProvider,
  useDashboard,
  RunningStateProvider,
  useRunningState,
  SessionProvider,
  TimingInterpolationProvider,
} from '@irdashies/context';
import { Settings } from './components/Settings/Settings';
import { EditMode } from './components/EditMode/EditMode';
import { ThemeManager } from './components/ThemeManager/ThemeManager';
import { TimingDebugInfo } from './components/Standings/components/TimingDebugInfo';
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
            element={running ? <WidgetComponent {...widget.config} /> : <></>}
          />
        );
      })}
      <Route path="/settings/*" element={<Settings />} />
    </Routes>
  );
};

const App = () => (
  <DashboardProvider bridge={window.dashboardBridge}>
    <RunningStateProvider bridge={window.irsdkBridge}>
      <SessionProvider bridge={window.irsdkBridge} />
      <TelemetryProvider bridge={window.irsdkBridge} />
      <TimingInterpolationProvider>
        <HashRouter>
          <EditMode>
            <ThemeManager>
              <AppRoutes />
              {/* Debug component - enable by setting localStorage.timingDebug = 'true' */}
              {localStorage.getItem('timingDebug') === 'true' && <TimingDebugInfo />}
            </ThemeManager>
          </EditMode>
        </HashRouter>
      </TimingInterpolationProvider>
    </RunningStateProvider>
  </DashboardProvider>
);

const el = document.getElementById('app');
if (!el) {
  throw new Error('No #app element found');
}

const root = createRoot(el);
root.render(<App />);
