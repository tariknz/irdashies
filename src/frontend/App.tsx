// App.tsx
import { createRoot } from 'react-dom/client';
import { HashRouter, Route, Routes, useParams } from 'react-router-dom';
import {
  TelemetryProvider,
  DashboardProvider,
  useDashboard,
  RunningStateProvider,
  useRunningState,
  SessionProvider,
  PitLaneProvider,
} from '@irdashies/context';
import type { DashboardWidget } from '@irdashies/types';
import { Settings } from './components/Settings/Settings';
import { EditMode } from './components/EditMode/EditMode';
import { ThemeManager } from './components/ThemeManager/ThemeManager';
import { WIDGET_MAP } from './WidgetIndex';
import { HideUIWrapper } from './components/HideUIWrapper/HideUIWrapper';

const WidgetLoader = () => {
  const { widgetId } = useParams<{ widgetId: string }>();
  const { currentDashboard } = useDashboard();
  const { running } = useRunningState();

  if (!currentDashboard || !widgetId) {
    return <div className="flex h-screen w-screen items-center justify-center text-slate-500 text-sm">Loading config...</div>;
  }

  // Find the widget configuration
  const widget = currentDashboard.widgets.find((w) => w.id === widgetId);

  // If strict match failed, check for legacy mappings or loose matching
  let resolvedWidget = widget;
  if (!resolvedWidget) {
      if (widgetId.startsWith('fuel2') || widgetId.startsWith('fuel-calculator')) {
           // Try to find the 'fuel' widget to fallback config, or create a temporary config?
           // Usually we want to find the ACTUAL 'fuel' widget instance if it exists
           resolvedWidget = currentDashboard.widgets.find((w) => w.id === 'fuel' || w.type === 'fuel');
           
           // If stil not found, we might need a default config for 'fuel'
           if (!resolvedWidget) {
               // Fallback: Construct a temporary widget object so it renders
               resolvedWidget = { id: widgetId, type: 'fuel', enabled: true, config: {} } as DashboardWidget; 
           }
      }
  }

  if (!resolvedWidget) {
     return <div className="flex h-screen w-screen items-center justify-center text-red-500 text-sm">Widget not found: {widgetId}</div>;
  }

  let componentType = resolvedWidget.type || resolvedWidget.id;
  // Normalize types
  if (componentType.startsWith('fuel2') || componentType === 'fuel-calculator') {
      componentType = 'fuel';
  }

  const WidgetComponent = WIDGET_MAP[componentType];
  if (!WidgetComponent) {
    return <div className="flex h-screen w-screen items-center justify-center text-red-500 text-sm">Component not found: {componentType}</div>;
  }

  if (!running) {
      return <></>; 
  }

  return <WidgetComponent {...resolvedWidget.config} />;
};

const AppRoutes = () => {
  return (
    <Routes>
      <Route path="/settings/*" element={<Settings />} />
      <Route path="/:widgetId" element={<WidgetLoader />} />
      <Route path="/" element={<div className="text-white">Dashboard Root</div>} />
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
