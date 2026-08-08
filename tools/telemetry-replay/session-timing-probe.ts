import * as yaml from 'js-yaml';
import type {
  Session,
  SessionTimingSnapshot,
  Telemetry,
} from '@irdashies/types';
import { SessionTimingProcessor } from '../../src/app/processors/SessionTimingProcessor';
import { LapTimesProcessor } from '../../src/app/processors/LapTimesProcessor';
import type { ReplayProbe, TelemetryFrame } from './validator';

const telemetryFrom = (frame: TelemetryFrame): Telemetry =>
  Object.fromEntries(
    Object.entries(frame).map(([name, entry]) => [
      name,
      { value: Array.isArray(entry) ? entry : [entry] },
    ])
  ) as unknown as Telemetry;

export const createSessionTimingProbe =
  (): ReplayProbe<SessionTimingSnapshot> => {
    const lapTimesProcessor = new LapTimesProcessor();
    const processor = new SessionTimingProcessor(
      () => lapTimesProcessor.snapshot().lapTimes
    );
    let checkpoint: string | undefined;
    let observedLap = false;
    return {
      name: 'session-timing-state',
      schemaVersion: 1,
      variables: [
        'CamCarIdx',
        'CarIdxBestLapTime',
        'CarIdxLap',
        'CarIdxLapCompleted',
        'CarIdxLapDistPct',
        'CarIdxLastLapTime',
        'CarIdxPosition',
        'LapDistPct',
        'SessionNum',
        'SessionState',
        'SessionTime',
        'SessionTimeRemain',
        'SessionTimeTotal',
      ],
      onSessionInfo(sessionYaml) {
        processor.init(yaml.load(sessionYaml, { json: true }) as Session);
      },
      onFrame(frame) {
        const telemetry = telemetryFrom(frame);
        lapTimesProcessor.onFrame(telemetry);
        processor.onFrame(telemetry);
        const snapshot = processor.snapshot();
        checkpoint = undefined;
        if (!observedLap && snapshot.currentLap > 0) {
          observedLap = true;
          checkpoint = 'first-observed-lap';
        }
        return { ...snapshot };
      },
      checkpoint() {
        return checkpoint;
      },
      onDisconnect() {
        lapTimesProcessor.onLifecycle({ type: 'disconnect' });
        processor.onLifecycle({ type: 'disconnect' });
      },
    };
  };
