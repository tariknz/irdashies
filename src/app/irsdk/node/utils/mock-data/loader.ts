import { TelemetryVarList, SessionData } from '../../../types';

export const loadMockSessionData = async (): Promise<SessionData> => {
  const json = await import('./session.json');
  return json.default as unknown as SessionData;
};

export const loadMockTelemetry = async (): Promise<TelemetryVarList> => {
  const json = await import('./telemetry.json');
  return json.default as unknown as TelemetryVarList;
};
