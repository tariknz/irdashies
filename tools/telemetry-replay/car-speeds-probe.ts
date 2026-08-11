import * as yaml from 'js-yaml';
import type { Session, Telemetry } from '@irdashies/types';
import { CarSpeedsProcessor } from '../../src/app/processors/CarSpeedsProcessor';
import type { ReplayProbe, TelemetryFrame } from './validator';

const telemetryFrom = (frame: TelemetryFrame): Telemetry =>
  Object.fromEntries(
    Object.entries(frame).map(([name, entry]) => [
      name,
      { value: Array.isArray(entry) ? entry : [entry] },
    ])
  ) as unknown as Telemetry;

export const createCarSpeedsProbe = (): ReplayProbe<
  ReturnType<CarSpeedsProcessor['snapshot']>
> => {
  const processor = new CarSpeedsProcessor();
  let checkpoint: string | undefined;
  let observedMovement = false;

  return {
    name: 'car-speeds-state',
    schemaVersion: 1,
    variables: ['CarIdxLapDistPct', 'SessionNum', 'SessionTime'],
    onSessionInfo(sessionYaml) {
      processor.init(yaml.load(sessionYaml, { json: true }) as Session);
    },
    onFrame(frame) {
      processor.onFrame(telemetryFrom(frame));
      const snapshot = processor.snapshot();
      checkpoint = undefined;
      if (
        !observedMovement &&
        snapshot.carSpeeds.some((speed) => speed !== 0)
      ) {
        observedMovement = true;
        checkpoint = 'first-moving-snapshot';
      }
      return snapshot;
    },
    checkpoint() {
      return checkpoint;
    },
    onDisconnect() {
      processor.onLifecycle({ type: 'disconnect' });
    },
  };
};
