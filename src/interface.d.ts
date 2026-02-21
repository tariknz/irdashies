import type {
  DashboardBridge,
  IrSdkBridge,
  PitLaneBridge,
  FuelCalculatorBridge,
  WindowControlsBridge,
} from '@irdashies/types';

declare global {
  interface Window {
    irsdkBridge: IrSdkBridge;
    dashboardBridge: DashboardBridge;
    pitLaneBridge: PitLaneBridge;
    fuelCalculatorBridge: FuelCalculatorBridge;
    windowControlsBridge: WindowControlsBridge;
  }
}
