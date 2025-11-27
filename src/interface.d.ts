import type { DashboardBridge, IrSdkBridge } from '@irdashies/types';

declare global {
  interface Window {
    irsdkBridge: IrSdkBridge;
    dashboardBridge: DashboardBridge;
  }
}
