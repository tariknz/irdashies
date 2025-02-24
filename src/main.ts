import { app } from 'electron';
import { IRacingBridge } from '@iracing-data/sdk';
import { getOrCreateDefaultDashboard } from './app/storage/dashboards';
import { setupTaskbar } from './app';
import { publishDashboardUpdates } from './app/bridge/dashboard/dashboardBridge';

// @ts-expect-error no types for squirrel
import started from 'electron-squirrel-startup';
import { TelemetrySink } from './app/bridge/iracingSdk/telemetrySink';
import { OverlayManager } from './app/overlayManager';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) app.quit();

const bridge = new IRacingBridge();
const overlayManager = new OverlayManager();
const telemetrySink = new TelemetrySink();

app.on('ready', () => {
  const dashboard = getOrCreateDefaultDashboard();
  overlayManager.createOverlays(dashboard);

  setupTaskbar(telemetrySink, overlayManager);
  publishDashboardUpdates(overlayManager);

  bridge.connectionEmitter.on('simConnect', (isConnected) => {
    console.log('Sending running state to window:', isConnected);
    overlayManager.publishMessage('runningState', isConnected);
  });

  bridge.telemetryEmitter
    .on('telemetry', (telemetry) => {
      overlayManager.publishMessage('telemetry', telemetry);
      telemetrySink.addTelemetry(telemetry);
    })
    .on('session', (session) => {
      overlayManager.publishMessage('sessionData', session);
      telemetrySink.addSession(session);
    });

  bridge.start();
});

app.on('window-all-closed', () => app.quit());
app.on('quit', () => console.warn('App quit'));
