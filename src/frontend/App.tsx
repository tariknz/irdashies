import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import {
  TelemetryProvider,
  DashboardProvider,
  useDashboard,
  RunningStateProvider,
  useRunningState,
  SessionProvider,
  useDrivingState,
} from '@irdashies/context';
import { Settings } from './components/Settings/Settings';
import { EditMode } from './components/EditMode/EditMode';
import { ThemeManager } from './components/ThemeManager/ThemeManager';
import { WIDGET_MAP } from './WidgetIndex';

const AppRoutes = () => {
  const { currentDashboard } = useDashboard();
  const { running } = useRunningState();
  const { isDriving } = useDrivingState();

  const shouldShowOverlays =
    currentDashboard?.generalSettings?.showOnlyWhenOnTrack === false ||
    isDriving;

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
              running && shouldShowOverlays ? (
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

const App = () => (
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
);

const el = document.getElementById('app');
if (!el) {
  throw new Error('No #app element found');
}

const root = createRoot(el);
root.render(<App />);
