import type { Telemetry, TrackStateSnapshot } from '@irdashies/types';
import { TrackStateProcessor } from '../../src/app/processors/TrackStateProcessor';
import type { ReplayProbe, TelemetryFrame } from './validator';

const telemetryFrom = (frame: TelemetryFrame): Telemetry =>
  Object.fromEntries(
    Object.entries(frame).map(([name, entry]) => [
      name,
      { value: Array.isArray(entry) ? entry : [entry] },
    ])
  ) as unknown as Telemetry;

const copySnapshot = (snapshot: TrackStateSnapshot): TrackStateSnapshot => ({
  ...snapshot,
  carIdxLapDistPct: [...snapshot.carIdxLapDistPct],
  carIdxOnPitRoad: [...snapshot.carIdxOnPitRoad],
  carIdxTrackSurface: [...snapshot.carIdxTrackSurface],
  carIdxClassPosition: [...snapshot.carIdxClassPosition],
});

export const createTrackStateProbe = (): ReplayProbe<TrackStateSnapshot> => {
  const processor = new TrackStateProcessor();
  return {
    name: 'track-state',
    schemaVersion: 2,
    variables: [
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
