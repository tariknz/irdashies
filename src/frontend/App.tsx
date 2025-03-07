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
import { Input } from './components/Input';
import { Standings } from './components/Standings/Standings';
import { Settings } from './components/Settings/Settings';
import { Relative } from './components/Standings/Relative';
import { Weather } from './components/Weather';
import { TrackMap } from './components/TrackMap/TrackMap';
import { EditMode } from './components/EditMode/EditMode';

// TODO: type this better, right now the config comes from settings
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WIDGET_MAP: Record<string, (config: any) => JSX.Element> = {
  standings: Standings,
  input: Input,
  relative: Relative,
  settings: Settings,
  map: TrackMap,
  weather: Weather,
};

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
      <Route path="/settings" element={<Settings />} />
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
          <AppRoutes />
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
