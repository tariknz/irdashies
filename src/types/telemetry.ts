import type {
  Driver as SdkDriver,
  TelemetryVariable,
  TelemetryVarList,
} from '@irsdk-node/types';

export type Telemetry = TelemetryVarList & {
  TrackWetness?: TelemetryVariable<number[]>;
};

export type TelemetryVar<T extends number[] | boolean[]> = TelemetryVariable<T>;
export type Driver = SdkDriver;
