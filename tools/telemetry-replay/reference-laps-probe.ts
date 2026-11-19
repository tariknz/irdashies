import { parseSession, telemetryFrom } from './processorInputs';
import { ReferenceLapProcessor } from '../../src/app/processors/ReferenceLapProcessor';
import type { ReplayProbe } from './validator';

interface ReferenceLapProbeState {
  bestLapTimes: readonly (readonly [number, number])[];
  persistedLapTimes: readonly (readonly [number, number])[];
  sessionNum: number | null;
  version: number;
}

const lapTimes = (
  laps: ReturnType<ReferenceLapProcessor['snapshot']>['bestLaps']
) => laps.map(([key, lap]) => [key, lap.finishTime - lap.startTime] as const);

export const createReferenceLapsProbe =
  (): ReplayProbe<ReferenceLapProbeState> => {
    const processor = new ReferenceLapProcessor({
      load: () => null,
      save: () => undefined,
    });
    let previousBestCount = 0;
    let checkpoint: string | undefined;
    let needsEnter = false;

    return {
      name: 'reference-laps-state',
      schemaVersion: 1,
      variables: [
        'CarIdxLapDistPct',
        'CarIdxOnPitRoad',
        'SessionNum',
        'SessionTime',
      ],
      onSessionInfo(sessionYaml) {
        if (needsEnter) {
          processor.onLifecycle({ type: 'enter', replay: false });
          previousBestCount = 0;
          needsEnter = false;
        }
        processor.init(parseSession(sessionYaml));
      },
      onFrame(frame) {
        processor.onFrame(telemetryFrom(frame));
        const snapshot = processor.snapshot();
        checkpoint = undefined;
        if (previousBestCount === 0 && snapshot.bestLaps.length > 0) {
          checkpoint = 'first-best-lap';
        }
        previousBestCount = snapshot.bestLaps.length;
        return {
          bestLapTimes: lapTimes(snapshot.bestLaps),
          persistedLapTimes: lapTimes(snapshot.persistedLaps),
          sessionNum: snapshot.sessionNum,
          version: snapshot.version,
        };
      },
      checkpoint() {
        return checkpoint;
      },
      onDisconnect() {
        processor.onLifecycle({ type: 'disconnect' });
        needsEnter = true;
      },
    };
  };
