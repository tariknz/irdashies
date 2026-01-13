import type { DashboardBridge, IrSdkBridge, PitLaneBridge } from '@irdashies/types';

declare global {
  interface Window {
    irsdkBridge: IrSdkBridge;
    dashboardBridge: DashboardBridge;
    electron?: {
      pitLane: PitLaneBridge;
    };
  }
}
