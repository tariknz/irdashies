import { parseSession, telemetryFrom } from './processorInputs';
import { CarSpeedsProcessor } from '../../src/app/processors/CarSpeedsProcessor';
import type { ReplayProbe } from './validator';
import { rateLimited } from './rateLimited';

export const createCarSpeedsProbe = (): ReplayProbe<
  ReturnType<CarSpeedsProcessor['snapshot']>
> => {
  const processor = rateLimited(new CarSpeedsProcessor());
  let checkpoint: string | undefined;
  let observedMovement = false;

  return {
    name: 'car-speeds-state',
    schemaVersion: 1,
    variables: ['SessionTick', 'CarIdxLapDistPct', 'SessionNum', 'SessionTime'],
    onSessionInfo(sessionYaml) {
      processor.init(parseSession(sessionYaml));
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
