import type { Session, Telemetry } from '@irdashies/types';
import type { ReplayPositionCommand } from '../app/irsdk/types/enums';

export interface IrSdkBridge {
  onTelemetry: (
    callback: (value: Telemetry) => void
  ) => (() => void) | undefined;
  onSessionData: (
    callback: (value: Session) => void
  ) => (() => void) | undefined;
  onRunningState: (
    callback: (value: boolean) => void
  ) => (() => void) | undefined;
  stop: () => void;
  changeCameraNumber: (
    carNumber: string,
    group: number,
    camera: number
  ) => void;
  changeReplayPosition: (
    position: ReplayPositionCommand,
    frame: number
  ) => void;
  triggerReplaySessionSearch: (
    sessionNum: number,
    sessionTimeMs: number
  ) => void;
}
