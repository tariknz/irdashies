import * as yaml from 'js-yaml';
import type {
  SectorTimingResultSnapshot,
  SectorTimingSnapshot,
  Session,
  Telemetry,
} from '@irdashies/types';
import { SectorTimingProcessor } from '../../src/app/processors/SectorTimingProcessor';
import type { ReplayProbe, TelemetryFrame } from './validator';

const telemetryFrom = (frame: TelemetryFrame): Telemetry =>
  Object.fromEntries(
    Object.entries(frame).map(([name, entry]) => [
      name,
      { value: Array.isArray(entry) ? entry : [entry] },
    ])
  ) as unknown as Telemetry;

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
        processor.init(yaml.load(sessionYaml, { json: true }) as Session);
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
