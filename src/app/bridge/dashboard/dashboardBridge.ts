import { ipcMain } from 'electron';
import { onDashboardUpdated } from '../../storage/dashboardEvents';
import { getDashboard, saveDashboard, resetDashboard } from '../../storage/dashboards';
import { OverlayManager } from '../../overlayManager';

export async function publishDashboardUpdates(overlayManager: OverlayManager) {
  onDashboardUpdated((dashboard) => {
    overlayManager.closeOrCreateWindows(dashboard);
    overlayManager.publishMessage('dashboardUpdated', dashboard);
  });
  ipcMain.on('saveDashboard', (_, dashboard, options) => {
    saveDashboard('default', dashboard);
    if (options?.forceReload) {
      overlayManager.forceRefreshOverlays(dashboard);
    }
  });
  ipcMain.on('reloadDashboard', () => {
    const dashboard = getDashboard('default');
    if (!dashboard) return;
    overlayManager.closeOrCreateWindows(dashboard);
    overlayManager.publishMessage('dashboardUpdated', dashboard);
  });

  ipcMain.handle('resetDashboard', (_, resetEverything: boolean) => {
    const result = resetDashboard(resetEverything, 'default');
    overlayManager.forceRefreshOverlays(result);
    return result;
  });

  ipcMain.handle('toggleLockOverlays', () => {
    return overlayManager.toggleLockOverlays();
  });

  ipcMain.handle('getAppVersion', () => {
    return overlayManager.getVersion();
  });
}
