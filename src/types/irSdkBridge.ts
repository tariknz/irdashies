import type { Session, Telemetry } from '@irdashies/types';

export interface IrSdkBridge {
  onTelemetry: (callback: (value: Telemetry) => void) => (() => void) | undefined;
  onSessionData: (callback: (value: Session) => void) => (() => void) | undefined;
  onRunningState: (callback: (value: boolean) => void) => (() => void) | undefined;
  stop: () => void;
}
