import type { TelemetryVariable, TelemetryVarList } from '../app/irsdk/types';

export type Telemetry = {
  [K in keyof TelemetryVarList]: Pick<TelemetryVarList[K], 'value'>;
};
export type TelemetryVar<T extends number[] | boolean[]> = Pick<TelemetryVariable<T>, 'value'>;
