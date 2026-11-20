import { telemetryFrom } from './processorInputs';
import type { LapLogSnapshot } from '@irdashies/types';
import { LapLogProcessor } from '../../src/app/processors/LapLogProcessor';
import type { ReplayProbe } from './validator';
import { rateLimited } from './rateLimited';

export const createLapLogProbe = (): ReplayProbe<LapLogSnapshot> => {
  const processor = rateLimited(new LapLogProcessor());
  return {
    name: 'lap-log-state',
    schemaVersion: 2,
    variables: [
      'SessionTick',
      'LapCompleted',
      'LapCurrentLapTime',
      'LapLastLapTime',
      'LapBestLapTime',
      'CarIdxBestLapTime',
      'SessionNum',
      'SessionTime',
      'SessionFlags',
      'PlayerTrackSurface',
      'PlayerCarMyIncidentCount',
      'LapDistPct',
      'LapDeltaToSessionLastlLap',
      'LapDeltaToSessionLastlLap_OK',
      'LapDeltaToSessionBestLap',
      'LapDeltaToSessionBestLap_OK',
    ],
    onFrame(frame) {
      processor.onFrame(telemetryFrom(frame));
      const snapshot = processor.snapshot();
      return {
        ...snapshot,
        carIdxBestLapTime: [...snapshot.carIdxBestLapTime],
      };
    },
    onDisconnect() {
      processor.onLifecycle({ type: 'disconnect' });
    },
  };
};
