import { telemetryFrom } from './processorInputs';
import type { TrackStateSnapshot } from '@irdashies/types';
import { TrackStateProcessor } from '../../src/app/processors/TrackStateProcessor';
import type { ReplayProbe } from './validator';
import { rateLimited } from './rateLimited';

const copySnapshot = (snapshot: TrackStateSnapshot): TrackStateSnapshot => ({
  ...snapshot,
  carIdxLapDistPct: [...snapshot.carIdxLapDistPct],
  carIdxOnPitRoad: [...snapshot.carIdxOnPitRoad],
  carIdxTrackSurface: [...snapshot.carIdxTrackSurface],
  carIdxClassPosition: [...snapshot.carIdxClassPosition],
});

export const createTrackStateProbe = (): ReplayProbe<TrackStateSnapshot> => {
  const processor = rateLimited(new TrackStateProcessor());
  return {
    name: 'track-state',
    schemaVersion: 3,
    variables: [
      'SessionTick',
      'LapLastLapTime',
      'LapCompleted',
      'CamCarIdx',
      'CarIdxLapDistPct',
      'CarIdxOnPitRoad',
      'CarIdxTrackSurface',
      'CarIdxClassPosition',
      'CarLeftRight',
      'IsOnTrack',
      'PlayerCarInPitStall',
      'PlayerTrackSurface',
      'OnPitRoad',
      'IsInGarage',
      'IsGarageVisible',
      'IsReplayPlaying',
      'SessionTime',
      'SessionState',
      'SessionFlags',
      'Speed',
      'DisplayUnits',
      'dcPitSpeedLimiterToggle',
      'PitstopActive',
      'EngineWarnings',
      'LapDistPct',
      'SessionNum',
    ],
    onFrame(frame) {
      processor.onFrame(telemetryFrom(frame));
      return copySnapshot(processor.snapshot());
    },
    onDisconnect() {
      processor.onLifecycle({ type: 'disconnect' });
    },
  };
};
