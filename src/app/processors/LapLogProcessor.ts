import type {
  LapLogSnapshot,
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import type { TelemetryProcessor } from './TelemetryProcessor';

const numberValue = (frame: Telemetry, key: keyof Telemetry): number => {
  const value = frame[key]?.value?.[0];
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
};

const booleanValue = (frame: Telemetry, key: keyof Telemetry): boolean => {
  const value = frame[key]?.value?.[0];
  return value === true || value === 1;
};

export class LapLogProcessor implements TelemetryProcessor<LapLogSnapshot> {
  readonly channel = 'lap-log.snapshot';
  readonly tickRateHz = 25;
  private readonly bestLaps: number[] = [];
  private readonly latest = this.empty();

  init(session: Session): void {
    void session;
  }

  onFrame(frame: Telemetry): void {
    const source = frame.CarIdxBestLapTime?.value;
    this.bestLaps.length = Array.isArray(source) ? source.length : 0;
    for (let index = 0; index < this.bestLaps.length; index += 1) {
      const value = source?.[index];
      this.bestLaps[index] =
        typeof value === 'number' && Number.isFinite(value) ? value : 0;
    }
    Object.assign(this.latest, {
      lapCompleted: numberValue(frame, 'LapCompleted'),
      currentLapTime: numberValue(frame, 'LapCurrentLapTime'),
      lastLapTime: numberValue(frame, 'LapLastLapTime'),
      bestLapTime: numberValue(frame, 'LapBestLapTime'),
      sessionNum: numberValue(frame, 'SessionNum'),
      sessionTime: numberValue(frame, 'SessionTime'),
      playerTrackSurface: numberValue(frame, 'PlayerTrackSurface'),
      incidentCount: numberValue(frame, 'PlayerCarMyIncidentCount'),
      lapDistPct: numberValue(frame, 'LapDistPct'),
      deltaToSessionLastLap: numberValue(frame, 'LapDeltaToSessionLastlLap'),
      deltaToSessionLastLapOk: booleanValue(
        frame,
        'LapDeltaToSessionLastlLap_OK'
      ),
      deltaToSessionBestLap: numberValue(frame, 'LapDeltaToSessionBestLap'),
      deltaToSessionBestLapOk: booleanValue(
        frame,
        'LapDeltaToSessionBestLap_OK'
      ),
      version: this.latest.version + 1,
    });
  }

  onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'enter') return;
    Object.assign(this.latest, this.empty(), {
      version: this.latest.version + 1,
    });
    this.bestLaps.length = 0;
  }

  snapshot(): LapLogSnapshot {
    return this.latest;
  }

  private empty(): LapLogSnapshot {
    return {
      lapCompleted: 0,
      currentLapTime: 0,
      lastLapTime: 0,
      bestLapTime: 0,
      carIdxBestLapTime: this.bestLaps,
      sessionNum: null,
      sessionTime: 0,
      playerTrackSurface: 0,
      incidentCount: 0,
      lapDistPct: 0,
      deltaToSessionLastLap: 0,
      deltaToSessionLastLapOk: false,
      deltaToSessionBestLap: 0,
      deltaToSessionBestLapOk: false,
      version: 0,
    };
  }
}
