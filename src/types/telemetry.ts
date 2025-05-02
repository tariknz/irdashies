import type { TelemetryVariable, TelemetryVarList } from '../app/irsdk/types';

export type Telemetry = TelemetryVarList & {
  TrackWetness?: TelemetryVariable<number[]>;
};

export type TelemetryVar<T extends number[] | boolean[]> = TelemetryVariable<T>;
