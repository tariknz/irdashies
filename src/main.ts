import { app } from 'electron';
import { iRacingSDKSetup } from './bridge/iracingSdk/setup';
import { getOrCreateDefaultDashboard } from './storage/dashboards';
import { createWidgets, setupTaskbar, trackWindowMovement } from './app';
import { publishDashboardUpdates } from './bridge/dashboard/dashboardBridge';

// @ts-expect-error no types for squirrel
import started from 'electron-squirrel-startup';
import { TelemetrySink } from './bridge/iracingSdk/telemetrySink';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) app.quit();

app.on('ready', () => {
  const dashboard = getOrCreateDefaultDashboard();
  createWidgets(dashboard.widgets).forEach(({ widget, window }) =>
    trackWindowMovement(widget, window)
  );

  const telemetrySink = new TelemetrySink();

  setupTaskbar(telemetrySink);
  iRacingSDKSetup(telemetrySink);
  publishDashboardUpdates();
});

app.on('window-all-closed', () => app.quit());
