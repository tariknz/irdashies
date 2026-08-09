import * as yaml from 'js-yaml';
import type { Session, StandingsSnapshot, Telemetry } from '@irdashies/types';
import { StandingsProcessor } from '../../src/app/processors/StandingsProcessor';
import type { ReplayProbe, TelemetryFrame } from './validator';

const telemetryFrom = (frame: TelemetryFrame): Telemetry =>
  Object.fromEntries(
    Object.entries(frame).map(([name, entry]) => [
      name,
      { value: Array.isArray(entry) ? entry : [entry] },
    ])
  ) as unknown as Telemetry;

const copySnapshot = (snapshot: StandingsSnapshot): StandingsSnapshot => ({
  ...snapshot,
  carIdxF2Time: [...snapshot.carIdxF2Time],
  carIdxPosition: [...snapshot.carIdxPosition],
  carIdxClassPosition: [...snapshot.carIdxClassPosition],
  carIdxBestLapTime: [...snapshot.carIdxBestLapTime],
  carIdxLastLapTime: [...snapshot.carIdxLastLapTime],
  carIdxEstTime: [...snapshot.carIdxEstTime],
  carIdxOnPitRoad: [...snapshot.carIdxOnPitRoad],
  carIdxLap: [...snapshot.carIdxLap],
  carIdxLapDistPct: [...snapshot.carIdxLapDistPct],
  carIdxTrackSurface: [...snapshot.carIdxTrackSurface],
  carIdxTireCompound: [...snapshot.carIdxTireCompound],
  carIdxSessionFlags: [...snapshot.carIdxSessionFlags],
  carIdxP2PStatus: [...snapshot.carIdxP2PStatus],
  carIdxP2PCount: [...snapshot.carIdxP2PCount],
  lastPitLap: [...snapshot.lastPitLap],
  previousCarTrackSurface: [...snapshot.previousCarTrackSurface],
  liveClassPosition: [...snapshot.liveClassPosition],
});

export const createStandingsProbe = (): ReplayProbe<StandingsSnapshot> => {
  const processor = new StandingsProcessor();
  let checkpoint: string | undefined;
  let firstLapObserved = false;

  return {
    name: 'standings-state',
    schemaVersion: 1,
    variables: [
      'CamCarIdx',
      'CarIdxEstTime',
      'CarIdxF2Time',
      'CarIdxPosition',
      'CarIdxClassPosition',
      'CarIdxBestLapTime',
      'CarIdxLastLapTime',
      'CarIdxLap',
      'CarIdxLapCompleted',
      'CarIdxLapDistPct',
      'CarIdxClass',
      'CarIdxOnPitRoad',
      'CarIdxSessionFlags',
      'CarIdxTireCompound',
      'CarIdxTrackSurface',
      'CarIdxP2P_Status',
      'CarIdxP2P_Count',
      'SessionUniqueID',
      'SessionNum',
      'SessionState',
      'SessionTime',
    ],
    onSessionInfo(sessionYaml) {
      processor.init(yaml.load(sessionYaml, { json: true }) as Session);
    },
    onFrame(frame) {
      processor.onFrame(telemetryFrom(frame));
      const snapshot = processor.snapshot();
      checkpoint = undefined;
      if (!firstLapObserved && snapshot.carIdxLap.some((lap) => lap > 0)) {
        firstLapObserved = true;
        checkpoint = 'first-observed-lap';
      }
      return copySnapshot(snapshot);
    },
    checkpoint() {
      return checkpoint;
    },
    onDisconnect() {
      processor.onLifecycle({ type: 'disconnect' });
    },
  };
};
