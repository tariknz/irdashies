import { parseSession, telemetryFrom } from './processorInputs';
import type { SessionTimingSnapshot } from '@irdashies/types';
import { SessionTimingProcessor } from '../../src/app/processors/SessionTimingProcessor';
import { LapTimesProcessor } from '../../src/app/processors/LapTimesProcessor';
import type { ReplayProbe } from './validator';
import { rateLimited } from './rateLimited';

export const createSessionTimingProbe =
  (): ReplayProbe<SessionTimingSnapshot> => {
    const lapTimesProcessor = new LapTimesProcessor();
    const processor = rateLimited(
      new SessionTimingProcessor(() => lapTimesProcessor.snapshot().lapTimes)
    );
    let checkpoint: string | undefined;
    let observedLap = false;
    return {
      name: 'session-timing-state',
      schemaVersion: 1,
      variables: [
        'SessionTick',
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
        processor.init(parseSession(sessionYaml));
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
