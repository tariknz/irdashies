import type { Session, Telemetry } from '@irdashies/types';

export enum ReplayPositionCommand {
  /** Beginning of the replay */
  Begin = 0,
  /** Current position in the replay */
  Current,
  /** End of the replay */
  End,
  /** Unused */
  Last,
}

export interface IrSdkBridge {
  onSessionData: (
    callback: (value: Session) => void
  ) => (() => void) | undefined;
  onRunningState: (
    callback: (value: boolean) => void
  ) => (() => void) | undefined;
  /**
   * The running state as it stands now, for a subscriber that arrived late.
   *
   * `onRunningState` only reports changes, so a window opened mid-session hears
   * nothing until the sim next starts or stops. Optional because not every
   * transport can answer — a subscriber that gets no answer simply waits for
   * the next change, as it did before.
   */
  getRunningState?: () => Promise<boolean>;
  stop: () => void;
}

/**
 * Main-process SDK source. Raw telemetry and the broadcast commands are not
 * part of the normal renderer API - the renderer drives those through
 * `raceControlBridge`.
 */
export interface IrSdkSourceBridge extends IrSdkBridge {
  onTelemetry: (
    callback: (value: Telemetry) => void
  ) => (() => void) | undefined;
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
