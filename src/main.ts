import { app, dialog, autoUpdater } from 'electron';
import { iRacingSDKSetup, getCurrentBridge } from './app/bridge/iracingSdk/setup';
import { getOrCreateDefaultDashboard } from './app/storage/dashboards';
import { setupTaskbar } from './app';
import { publishDashboardUpdates, dashboardBridge } from './app/bridge/dashboard/dashboardBridge';
import { TelemetrySink } from './app/bridge/iracingSdk/telemetrySink';
import { OverlayManager } from './app/overlayManager';
import { startComponentServer } from './app/webserver/componentServer';
import { updateElectronApp } from 'update-electron-app';
// @ts-expect-error no types for squirrel
import started from 'electron-squirrel-startup';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) app.quit();

function formatReleaseNotes(notes: string): string {
  return notes
    .replace(/^#+\s+/gm, '') // Remove markdown headers
    .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold markdown
    .replace(/\*(.*?)\*/g, '$1') // Remove italic markdown
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // Convert links to plain text
    .replace(/`([^`]+)`/g, '$1') // Remove inline code markers
    .trim();
}

updateElectronApp({
  onNotifyUser: (info) => {
    const formattedNotes = formatReleaseNotes(info.releaseNotes || 'No release notes available.');
    const releaseDate = info.releaseDate
      ? info.releaseDate.toLocaleDateString()
      : '';

    dialog
      .showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: `A new version (${info.releaseName || 'latest'}) is ready to install.`,
        detail: releaseDate
          ? `Release Date: ${releaseDate}\n\n${formattedNotes}`
          : formattedNotes,
        buttons: ['Restart Now', 'Later'],
        defaultId: 0,
        cancelId: 1,
      })
      .then((result) => {
        if (result.response === 0) {
          autoUpdater.quitAndInstall();
        }
      });
  },
});

const overlayManager = new OverlayManager();
const telemetrySink = new TelemetrySink();

overlayManager.setupHardwareAcceleration();
overlayManager.setupSingleInstanceLock();

app.on('ready', async () => {
  // Don't start services if we don't have the single instance lock
  // (this instance should be quitting)
  if (!overlayManager.hasLock()) {
    return;
  }

  await iRacingSDKSetup(telemetrySink, overlayManager);

  const dashboard = getOrCreateDefaultDashboard();
  const bridge = getCurrentBridge();

  // Start component server for browser components
  await startComponentServer(bridge, dashboardBridge);

  overlayManager.createOverlays(dashboard);
  setupTaskbar(telemetrySink, overlayManager);
  publishDashboardUpdates(overlayManager);
});

app.on('window-all-closed', () => app.quit());
app.on('quit', () => console.warn('App quit'));
