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
    let targetIndex = 0;
    let changed = false;
    if (Array.isArray(source)) {
      for (const value of source) {
        if (typeof value === 'number' && value >= 0) {
          if (target[targetIndex] !== value) {
            target[targetIndex] = value;
            changed = true;
          }
          targetIndex += 1;
        }
      }
    }
    if (target.length !== targetIndex) changed = true;
    target.length = targetIndex;
    if (changed) this.latest.version += 1;
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
