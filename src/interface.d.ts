import type {
  DashboardBridge,
  IrSdkBridge,
  PitLaneBridge,
  FuelCalculatorBridge,
  ReferenceLapBridge,
  LogBridge,
  KeybindingsBridge,
  ChromiumFlagsBridge,
} from '@irdashies/types';

declare global {
  interface Window {
    irsdkBridge: IrSdkBridge;
    dashboardBridge: DashboardBridge;
    pitLaneBridge: PitLaneBridge;
    fuelCalculatorBridge: FuelCalculatorBridge;
    referenceLapsBridge: ReferenceLapBridge;
    logBridge: LogBridge;
    keybindingsBridge: KeybindingsBridge;
    chromiumFlagsBridge: ChromiumFlagsBridge;
  }
}
