import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes } from 'react-router-dom';
import {
  TelemetryProvider,
  DashboardProvider,
  useDashboard,
  RunningStateProvider,
  useRunningState,
} from '@irdashies/context';
import { Input } from './components/Input';
import { Standings } from './components/Standings/Standings';
import { Settings } from './components/Settings/Settings';
import { Relative } from './components/Standings/Relative';
import { TrackOverlay } from './components/TrackMap/TrackOverlay';
import { EditMode } from './components/EditMode/EditMode';

// I don't really know why interface.d.ts isn't being picked up so just redefining it here.
declare global {
  interface Window {
    irsdkBridge: import('@irdashies/types').IrSdkBridge;
    dashboardBridge: import('@irdashies/types').DashboardBridge;
  }
}

// TODO: type this better, right now the config comes from settings
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const WIDGET_MAP: Record<string, (config: any) => JSX.Element> = {
  standings: Standings,
  input: Input,
  relative: Relative,
  settings: Settings,
  map: TrackOverlay,
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

        if (!running) {
          return null;
        }

        return (
          <Route
            key={widget.id}
            path={`/${widget.id}`}
            element={<WidgetComponent {...widget.config} />}
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
      <TelemetryProvider bridge={window.irsdkBridge}>
        <HashRouter>
          <EditMode>
            <AppRoutes />
          </EditMode>
        </HashRouter>
      </TelemetryProvider>
    </RunningStateProvider>
  </DashboardProvider>
);

const el = document.getElementById('app');
if (!el) {
  throw new Error('No #app element found');
}

const root = createRoot(el);
root.render(<App />);