import { TelemetryVarList } from '../../../types';
import yaml from 'js-yaml';

export const loadMockSessionData = async (): Promise<string> => {
  const json = await import('./session.json');
  return yaml.dump(json.default);
};

export const loadMockTelemetry = async (): Promise<TelemetryVarList> => {
  const json = await import('./telemetry.json');
  return json.default as unknown as TelemetryVarList;
};
