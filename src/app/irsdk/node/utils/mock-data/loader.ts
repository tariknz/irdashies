import { TelemetryVarList } from '../../../types';

export const loadMockSessionData = async (): Promise<string> => {
  const json = await import('./session.json');
  return JSON.stringify(json.default);
};

export const loadMockTelemetry = async (): Promise<TelemetryVarList> => {
  const json = await import('./telemetry.json');
  return json.default as unknown as TelemetryVarList;
};
