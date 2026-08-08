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
  carIdxEstTime: [...snapshot.carIdxEstTime],
  carIdxOnPitRoad: [...snapshot.carIdxOnPitRoad],
  carIdxLap: [...snapshot.carIdxLap],
  carIdxLapDistPct: [...snapshot.carIdxLapDistPct],
  carIdxTrackSurface: [...snapshot.carIdxTrackSurface],
  carIdxTireCompound: [...snapshot.carIdxTireCompound],
  carIdxSessionFlags: [...snapshot.carIdxSessionFlags],
  lastPitLap: [...snapshot.lastPitLap],
  previousCarTrackSurface: [...snapshot.previousCarTrackSurface],
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
      'CarIdxLap',
      'CarIdxLapDistPct',
      'CarIdxOnPitRoad',
      'CarIdxSessionFlags',
      'CarIdxTireCompound',
      'CarIdxTrackSurface',
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
