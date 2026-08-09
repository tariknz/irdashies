import type { LapLogSnapshot, Telemetry } from '@irdashies/types';
import { LapLogProcessor } from '../../src/app/processors/LapLogProcessor';
import type { ReplayProbe, TelemetryFrame } from './validator';

const telemetryFrom = (frame: TelemetryFrame): Telemetry =>
  Object.fromEntries(
    Object.entries(frame).map(([name, entry]) => [
      name,
      { value: Array.isArray(entry) ? entry : [entry] },
    ])
  ) as unknown as Telemetry;

export const createLapLogProbe = (): ReplayProbe<LapLogSnapshot> => {
  const processor = new LapLogProcessor();
  return {
    name: 'lap-log-state',
    schemaVersion: 1,
    variables: [
      'LapCompleted',
      'LapCurrentLapTime',
      'LapLastLapTime',
      'LapBestLapTime',
      'CarIdxBestLapTime',
      'SessionNum',
      'SessionTime',
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
