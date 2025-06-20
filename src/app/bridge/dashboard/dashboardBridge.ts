import { ipcMain } from 'electron';
import { onDashboardUpdated } from '../../storage/dashboardEvents';
import { getDashboard, saveDashboard, resetDashboard } from '../../storage/dashboards';
import { OverlayManager } from 'src/app/overlayManager';

export async function publishDashboardUpdates(overlayManager: OverlayManager) {
  onDashboardUpdated((dashboard) => {
    overlayManager.closeOrCreateWindows(dashboard);
    overlayManager.publishMessage('dashboardUpdated', dashboard);
  });
  ipcMain.on('saveDashboard', (_, dashboard) => {
    saveDashboard('default', dashboard);
  });
  ipcMain.on('reloadDashboard', () => {
    const dashboard = getDashboard('default');
    if (!dashboard) return;
    overlayManager.closeOrCreateWindows(dashboard);
    overlayManager.publishMessage('dashboardUpdated', dashboard);
  });

  ipcMain.handle('resetDashboard', (_, resetEverything: boolean) => {
    return resetDashboard(resetEverything, 'default');
  });

  ipcMain.handle('toggleLockOverlays', () => {
    return overlayManager.toggleLockOverlays();
  });

  ipcMain.handle('getAppVersion', () => {
    return overlayManager.getVersion();
  });
}
