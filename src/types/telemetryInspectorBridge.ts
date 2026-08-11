import type { Session, Telemetry } from '@irdashies/types';

export const TELEMETRY_INSPECTOR_RATE_HZ = 10;

/**
 * Explicit diagnostic escape hatch for inspecting arbitrary SDK values.
 * Normal widgets must use typed snapshot channels instead.
 */
export interface TelemetryInspectorBridge {
  onTelemetry: (
    callback: (value: Telemetry) => void
  ) => (() => void) | undefined;
  onSessionData: (
    callback: (value: Session) => void
  ) => (() => void) | undefined;
}
