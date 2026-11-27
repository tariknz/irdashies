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
    globalKey?: {
      onToggle: (cb: (hide: boolean) => void) => () => void;
      onWidgetToggle: (
        cb: (widgetId: string, hide: boolean) => void
      ) => () => void;
    };
    widgetPreviewBridge?: import('./types/widgetPreview').WidgetPreviewBridge;
    storageStatusBridge?: import('./types/storageStatus').StorageStatusBridge;
    channelBridge: ChannelBridge;
    windowVisibilityBridge?: import('./types/windowVisibility').WindowVisibilityBridge;
    irsdkBridge: IrSdkBridge;
    telemetryInspectorBridge: TelemetryInspectorBridge;
    dashboardBridge: DashboardBridge;
    pitLaneBridge: PitLaneBridge;
    fuelCalculatorBridge: FuelCalculatorBridge;
    logBridge: LogBridge;
    keybindingsBridge: KeybindingsBridge;
    /** Present only in the hidden WebHID host renderer (src/hidHost.ts). */
    gamepadHost?: GamepadHostBridge;
    releaseNotesBridge?: import('./types/releaseNotes').ReleaseNotesBridge;
    appUpdatesBridge?: import('./types/appUpdates').AppUpdatesBridge;
    chromiumFlagsBridge: ChromiumFlagsBridge;
    raceControlBridge: RaceControlBridge;
    /** Absent outside the Electron preload, e.g. the browser server. */
    lapHistoryBridge?: LapHistoryBridge;
    rendererPerfBridge?: RendererPerfBridge;
    tapeReplayBridge?: import('./types/tapeReplay').TapeReplayBridge;
    /** Absent outside the Electron preload, e.g. the browser server. */
    racePlanBridge?: import('./types/racePlan').RacePlanBridge;
    replayDirectorBridge?: import('./types/replayDirector').ReplayDirectorBridge;
  }
}
