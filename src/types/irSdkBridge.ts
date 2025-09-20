import type { Session, OverlayTelemetryPayload } from '@irdashies/types';

export interface IrSdkBridge {
  onTelemetry: (callback: (value: OverlayTelemetryPayload) => void) => void;
  onSessionData: (callback: (value: Session) => void) => void;
  onRunningState: (callback: (value: boolean) => void) => void;
  stop: () => void;
}
