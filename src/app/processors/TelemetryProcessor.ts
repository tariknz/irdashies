import type {
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';

export interface TelemetryProcessor<Snapshot, Channel extends string = string> {
  readonly channel: Channel;
  readonly tickRateHz: number | 'event';
  init(session: Session): void;
  onFrame(frame: Telemetry): void;
  onLifecycle(event: SessionLifecycleEvent): void;
  snapshot(): Snapshot;
}
