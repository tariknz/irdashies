import { parseSession, telemetryFrom } from './processorInputs';
import type { SessionBarSnapshot } from '@irdashies/types';
import { SessionBarProcessor } from '../../src/app/processors/SessionBarProcessor';
import type { ReplayProbe } from './validator';
import { rateLimited } from './rateLimited';

export const createSessionBarProbe = (): ReplayProbe<SessionBarSnapshot> => {
  const processor = rateLimited(new SessionBarProcessor());
  return {
    name: 'session-bar-state',
    schemaVersion: 1,
    variables: [
      'SessionTick',
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
      processor.init(parseSession(text));
    },
    onFrame(frame) {
      processor.onFrame(telemetryFrom(frame));
      const snapshot = processor.snapshot();
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
