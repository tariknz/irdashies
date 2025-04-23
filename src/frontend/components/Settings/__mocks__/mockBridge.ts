import type { DashboardBridge } from '@irdashies/types';
import { defaultDashboard } from '../../../../app/storage/defaultDashboard';

export const mockDashboardBridge: DashboardBridge = {
  reloadDashboard: () => {},
  saveDashboard: () => {},
  dashboardUpdated: (callback) => {
    callback(defaultDashboard);
    return () => {};
  },
  onEditModeToggled: (callback) => {
    callback(false);
    return () => {};
  },
}; 