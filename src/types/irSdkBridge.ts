import type { Session, Telemetry } from '@irdashies/types';

export interface IrSdkBridge {
  onTelemetry: (callback: (value: Telemetry) => void) => void | (() => void);
  onSessionData: (callback: (value: Session) => void) => void | (() => void);
  onRunningState: (callback: (value: boolean) => void) => void | (() => void);
  stop: () => void;
}
