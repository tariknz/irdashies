import { parseSession, telemetryFrom } from './processorInputs';
import type {
  SectorTimingResultSnapshot,
  SectorTimingSnapshot,
} from '@irdashies/types';
import { SectorTimingProcessor } from '../../src/app/processors/SectorTimingProcessor';
import type { ReplayProbe } from './validator';

const copyResult = (
  result: SectorTimingResultSnapshot
): SectorTimingResultSnapshot => ({
  currentLapSectorTimes: [...result.currentLapSectorTimes],
  previousLapSectorTimes: [...result.previousLapSectorTimes],
  currentLapSectorUnclean: [...result.currentLapSectorUnclean],
  previousLapSectorUnclean: [...result.previousLapSectorUnclean],
  sessionBestSectorTimes: [...result.sessionBestSectorTimes],
  previousSessionBestSectorTimes: [...result.previousSessionBestSectorTimes],
});

const copySnapshot = (
  snapshot: SectorTimingSnapshot
): SectorTimingSnapshot => ({
  ...snapshot,
  sectors: snapshot.sectors.map((sector) => ({ ...sector })),
  inclusive: copyResult(snapshot.inclusive),
  clean: copyResult(snapshot.clean),
});

export const createSectorTimingProbe =
  (): ReplayProbe<SectorTimingSnapshot> => {
    const processor = new SectorTimingProcessor();
    let checkpoint: string | undefined;
    let firstCrossingObserved = false;

    return {
      name: 'sector-timing-state',
      schemaVersion: 1,
      variables: ['IsOnTrack', 'LapDistPct', 'SessionNum', 'SessionTime'],
      onSessionInfo(sessionYaml) {
        processor.init(parseSession(sessionYaml));
      },
      onFrame(frame) {
        processor.onFrame(telemetryFrom(frame));
        const snapshot = processor.snapshot();
        checkpoint = undefined;
        if (
          !firstCrossingObserved &&
          snapshot.inclusive.previousLapSectorTimes.some(
            (time) => time !== null
          )
        ) {
          firstCrossingObserved = true;
          checkpoint = 'first-sector-crossing';
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
