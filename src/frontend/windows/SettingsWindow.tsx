import { HashRouter, Route, Routes } from 'react-router-dom';
import {
  DashboardProvider,
  RunningStateProvider,
  SessionProvider,
} from '@irdashies/context';
import { Settings } from '../components/Settings/Settings';
import { TrailingSlashRedirect } from '../components/Settings/TrailingSlashRedirect';

export default function SettingsWindow() {
  return (
    <DashboardProvider bridge={window.dashboardBridge}>
      <RunningStateProvider bridge={window.irsdkBridge}>
        <SessionProvider bridge={window.irsdkBridge} />
        <HashRouter>
          <Routes>
            <Route
              path="/settings/*"
              element={
                <TrailingSlashRedirect>
                  <Settings />
                </TrailingSlashRedirect>
              }
            />
          </Routes>
        </HashRouter>
      </RunningStateProvider>
    </DashboardProvider>
  );
}
