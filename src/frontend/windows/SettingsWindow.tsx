import { HashRouter, Route, Routes } from 'react-router-dom';
import {
  DashboardProvider,
  RunningStateProvider,
  SessionProvider,
} from '@irdashies/context';
import { Settings } from '../components/Settings/Settings';

export default function SettingsWindow() {
  return (
    <DashboardProvider bridge={window.dashboardBridge}>
      <RunningStateProvider bridge={window.irsdkBridge}>
        <SessionProvider bridge={window.irsdkBridge} />
        <HashRouter>
          <Routes>
            <Route path="/settings/*" element={<Settings />} />
          </Routes>
        </HashRouter>
      </RunningStateProvider>
    </DashboardProvider>
  );
}
