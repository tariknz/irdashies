import type {
  RadioSnapshot,
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import type { TelemetryProcessor } from './TelemetryProcessor';

export class RadioProcessor implements TelemetryProcessor<RadioSnapshot> {
  readonly channel = 'radio.snapshot';
  readonly tickRateHz = 'event';

  private enabled = true;
  private readonly candidateCarIdxs: number[] = [];
  private readonly latest: RadioSnapshot = {
    transmittingCarIdxs: [],
    version: 0,
  };

  init(session: Session): void {
    void session;
  }

  onFrame(frame: Telemetry): void {
    if (!this.enabled) return;
    const source = frame.RadioTransmitCarIdx?.value;
    const target = this.latest.transmittingCarIdxs as number[];
    const candidate = this.candidateCarIdxs;
    candidate.length = 0;
    if (Array.isArray(source)) {
      for (const value of source) {
        if (
          typeof value === 'number' &&
          value >= 0 &&
          !candidate.includes(value)
        )
          candidate.push(value);
      }
    }
    candidate.sort((a, b) => a - b);
    let changed = target.length !== candidate.length;
    for (let index = 0; index < candidate.length; index += 1) {
      if (target[index] !== candidate[index]) changed = true;
    }
    if (!changed) return;
    target.length = candidate.length;
    for (let index = 0; index < candidate.length; index += 1)
      target[index] = candidate[index];
    this.latest.version += 1;
  }

  onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'enter') {
      this.enabled = !event.replay;
      if (!this.enabled) this.reset();
      return;
    }
    this.reset();
  }

  snapshot(): RadioSnapshot {
    return this.latest;
  }

  private reset(): void {
    if (this.latest.transmittingCarIdxs.length === 0) return;
    (this.latest.transmittingCarIdxs as number[]).length = 0;
    this.latest.version += 1;
  }
}
