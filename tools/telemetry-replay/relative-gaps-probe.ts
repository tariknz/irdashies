import { parseSession, telemetryFrom } from './processorInputs';
import { ReferenceLapProcessor } from '../../src/app/processors/ReferenceLapProcessor';
import { RelativeGapProcessor } from '../../src/app/processors/RelativeGapProcessor';
import type { ReplayProbe } from './validator';
import { rateLimited } from './rateLimited';

export const createRelativeGapsProbe = (): ReplayProbe<
  ReturnType<RelativeGapProcessor['snapshot']>
> => {
  const referenceLaps = new ReferenceLapProcessor({
    load: () => null,
    save: () => undefined,
  });
  const processor = rateLimited(new RelativeGapProcessor(referenceLaps));
  let checkpoint: string | undefined;
  let observedDelta = false;

  return {
    name: 'relative-gaps-state',
    schemaVersion: 1,
    variables: [
      'SessionTick',
      'CamCarIdx',
      'CarIdxEstTime',
      'CarIdxLap',
      'CarIdxLapDistPct',
      'CarIdxOnPitRoad',
      'SessionNum',
      'SessionTime',
    ],
    onSessionInfo(sessionYaml) {
      const session = parseSession(sessionYaml);
      referenceLaps.init(session);
      processor.init(session);
    },
    onFrame(frame) {
      const telemetry = telemetryFrom(frame);
      referenceLaps.onFrame(telemetry);
      processor.onFrame(telemetry);
      const snapshot = processor.snapshot();
      checkpoint = undefined;
      if (
        !observedDelta &&
        snapshot.deltas.some((delta) => delta !== null && delta !== 0)
      ) {
        observedDelta = true;
        checkpoint = 'first-relative-delta';
      }
      return {
        ...snapshot,
        relativePcts: [...snapshot.relativePcts],
        deltas: [...snapshot.deltas],
      };
    },
    checkpoint() {
      return checkpoint;
    },
    onDisconnect() {
      referenceLaps.onLifecycle({ type: 'disconnect' });
      processor.onLifecycle({ type: 'disconnect' });
    },
  };
};
