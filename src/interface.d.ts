import type { DashboardBridge, IrSdkBridge, PitLaneBridge, FuelCalculatorBridge } from '@irdashies/types';

declare global {
  interface Window {
    irsdkBridge: IrSdkBridge;
    dashboardBridge: DashboardBridge;
    pitLaneBridge: PitLaneBridge;
    fuelCalculatorBridge: FuelCalculatorBridge;
  }
}
