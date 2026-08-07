import type {
  DashboardBridge,
  IrSdkBridge,
  PitLaneBridge,
  FuelCalculatorBridge,
  ReferenceLapBridge,
  LogBridge,
  KeybindingsBridge,
  GamepadHostBridge,
  ChromiumFlagsBridge,
  RaceControlBridge,
} from '@irdashies/types';
import type { ChannelBridge } from '@irdashies/types';

declare global {
  interface Window {
    channelBridge: ChannelBridge;
    irsdkBridge: IrSdkBridge;
    dashboardBridge: DashboardBridge;
    pitLaneBridge: PitLaneBridge;
    fuelCalculatorBridge: FuelCalculatorBridge;
    referenceLapsBridge: ReferenceLapBridge;
    logBridge: LogBridge;
    keybindingsBridge: KeybindingsBridge;
    /** Present only in the hidden WebHID host renderer (src/hidHost.ts). */
    gamepadHost?: GamepadHostBridge;
    chromiumFlagsBridge: ChromiumFlagsBridge;
    raceControlBridge: RaceControlBridge;
  }
}
