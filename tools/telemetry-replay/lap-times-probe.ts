import type { Telemetry } from '../../src/types';
import { LapTimesProcessor } from '../../src/app/processors/LapTimesProcessor';
import type { ReplayProbe, TelemetryFrame } from './validator';

const telemetryFrom = (frame: TelemetryFrame): Telemetry =>
  Object.fromEntries(
    Object.entries(frame).map(([name, entry]) => [
      name,
      { value: Array.isArray(entry) ? entry : [entry] },
    ])
  ) as unknown as Telemetry;

export const createLapTimesProbe = (): ReplayProbe<
  ReturnType<LapTimesProcessor['snapshot']>
> => {
  const processor = new LapTimesProcessor();
  let checkpoint: string | undefined;
  let previousVersion = 0;
  const recordedDepths = new Set<number>();

  return {
    name: 'lap-times-state',
    schemaVersion: 1,
    variables: ['CarIdxLastLapTime', 'SessionNum'],
    onFrame(frame) {
      processor.onFrame(telemetryFrom(frame));
      const snapshot = processor.snapshot();
      checkpoint = undefined;
      if (snapshot.version !== previousVersion) {
        const maxHistory = snapshot.lapTimeHistory.reduce(
          (max, history) => Math.max(max, history.length),
          0
        );
        if (maxHistory === 1 && !recordedDepths.has(maxHistory)) {
          recordedDepths.add(maxHistory);
          checkpoint = `history-depth:${maxHistory}`;
        }
      }
      previousVersion = snapshot.version;
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
