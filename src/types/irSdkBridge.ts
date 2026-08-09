import type { Session, Telemetry } from '@irdashies/types';

export interface IrSdkBridge {
  onSessionData: (
    callback: (value: Session) => void
  ) => (() => void) | undefined;
  onRunningState: (
    callback: (value: boolean) => void
  ) => (() => void) | undefined;
  stop: () => void;
}

/** Main-process SDK source. Raw telemetry is not part of the normal renderer API. */
export interface IrSdkSourceBridge extends IrSdkBridge {
  onTelemetry: (
    callback: (value: Telemetry) => void
  ) => (() => void) | undefined;
}
