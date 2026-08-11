import * as yaml from 'js-yaml';
import type { Session, SessionBarSnapshot, Telemetry } from '@irdashies/types';
import { SessionBarProcessor } from '../../src/app/processors/SessionBarProcessor';
import type { ReplayProbe, TelemetryFrame } from './validator';

const telemetryFrom = (frame: TelemetryFrame): Telemetry =>
  Object.fromEntries(
    Object.entries(frame).map(([name, entry]) => [
      name,
      { value: Array.isArray(entry) ? entry : [entry] },
    ])
  ) as unknown as Telemetry;
export const createSessionBarProbe = (): ReplayProbe<SessionBarSnapshot> => {
  const processor = new SessionBarProcessor();
  return {
    name: 'session-bar-state',
    schemaVersion: 1,
    variables: [
      'AirTemp',
      'CarIdxBestLapTime',
      'CarIdxClassPosition',
      'CarIdxPosition',
      'DisplayUnits',
      'dcBrakeBias',
      'FuelLevel',
      'Lap',
      'LapBestLapTime',
      'LapLastLapTime',
      'PlayerCarTeamIncidentCount',
      'Precipitation',
      'RelativeHumidity',
      'SessionNum',
      'SessionTime',
      'SessionTimeOfDay',
      'Speed',
      'TrackTempCrew',
      'TrackWetness',
      'WindDir',
      'WindVel',
      'YawNorth',
    ],
    onSessionInfo(text) {
      processor.init(yaml.load(text, { json: true }) as Session);
    },
    onFrame(frame) {
      const snapshot =
        (processor.onFrame(telemetryFrom(frame)), processor.snapshot());
      return {
        ...snapshot,
        competitorCarIds: [...snapshot.competitorCarIds],
        competitorPositions: [...snapshot.competitorPositions],
      };
    },
    onDisconnect() {
      processor.onLifecycle({ type: 'disconnect' });
    },
  };
};
