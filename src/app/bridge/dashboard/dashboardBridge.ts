import { ipcMain } from 'electron';
import { onDashboardUpdated } from '../../storage/dashboardEvents';
import { getDashboard, saveDashboard } from '../../storage/dashboards';
import { OverlayManager } from 'src/app/overlayManager';

export async function publishDashboardUpdates(overlayManager: OverlayManager) {
  onDashboardUpdated((dashboard) => {
    overlayManager.publishMessage('dashboardUpdated', dashboard);
  });
  ipcMain.on('saveDashboard', (_, dashboard) => {
    saveDashboard('default', dashboard);
  });
  ipcMain.on('reloadDashboard', () => {
    const dashboard = getDashboard('default');
    overlayManager.publishMessage('dashboardUpdated', dashboard);
  });
}