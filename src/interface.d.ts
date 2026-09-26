import type {
  DashboardBridge,
  IrSdkBridge,
  PitLaneBridge,
  FuelCalculatorBridge,
  LogBridge,
  KeybindingsBridge,
  GamepadHostBridge,
  ChromiumFlagsBridge,
  RaceControlBridge,
  LapHistoryBridge,
  TelemetryInspectorBridge,
  RendererPerfBridge,
} from '@irdashies/types';
import type { ChannelBridge } from '@irdashies/types';

declare global {
  interface Window {
    channelBridge: ChannelBridge;
    irsdkBridge: IrSdkBridge;
    telemetryInspectorBridge: TelemetryInspectorBridge;
    dashboardBridge: DashboardBridge;
    pitLaneBridge: PitLaneBridge;
    fuelCalculatorBridge: FuelCalculatorBridge;
    logBridge: LogBridge;
    keybindingsBridge: KeybindingsBridge;
    /** Present only in the hidden WebHID host renderer (src/hidHost.ts). */
    gamepadHost?: GamepadHostBridge;
    chromiumFlagsBridge: ChromiumFlagsBridge;
    raceControlBridge: RaceControlBridge;
    /** Absent outside the Electron preload, e.g. the browser server. */
    lapHistoryBridge?: LapHistoryBridge;
    rendererPerfBridge?: RendererPerfBridge;
  }
}
