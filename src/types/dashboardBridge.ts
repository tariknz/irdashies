import { DashboardLayout } from './dashboardLayout';

export interface DashboardBridge {
  onEditModeToggled: (callback: (value: boolean) => void) => void;
  dashboardUpdated: (callback: (value: DashboardLayout) => void) => void;
  reloadDashboard: () => void;
  saveDashboard: (value: DashboardLayout) => void;
  toggleLockOverlays: () => Promise<boolean>;
}
