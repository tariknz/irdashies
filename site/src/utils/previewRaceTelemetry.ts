import { GlobalFlags, SessionState, type Telemetry } from '@irdashies/types';

/** The recorded fixture ended under the checkered flag; the preview is racing. */
export function previewRaceTelemetry(frame: Telemetry): Telemetry {
  return {
    ...frame,
    SessionState: { ...frame.SessionState, value: [SessionState.Racing] },
    SessionFlags: { ...frame.SessionFlags, value: [GlobalFlags.Green] },
    SessionLapsRemainEx: {
      ...frame.SessionLapsRemainEx,
      value: frame.SessionLapsRemain.value,
    },
  };
}
