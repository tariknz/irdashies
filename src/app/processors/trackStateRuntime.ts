import type {
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import type { ChannelBus } from '../bridge/channelBridge';
import type { SessionLifecycle } from '../sessionLifecycle';
import { TrackStateProcessor } from './TrackStateProcessor';

interface PerformanceSections {
  markStart(label: string): void;
  markEnd(label: string): void;
}

export class TrackStateRuntime {
  private processor?: TrackStateProcessor;
  private latestSession?: Session;
  private publishedVersion = -1;
  private readonly disconnects: (() => void)[];

  constructor(
    private readonly bus: ChannelBus,
    lifecycle: SessionLifecycle | undefined,
    private readonly metrics: PerformanceSections
  ) {
    this.disconnects = [
      bus.onSubscriberCountChanged((channel, count) => {
        if (channel !== 'track-state.snapshot') return;
        if (count > 0) this.activate();
        else this.deactivate();
      }),
    ];
    if (lifecycle) {
      this.disconnects.push(
        lifecycle.onSessionNumChange(() =>
          this.onLifecycle({ type: 'sessionNumChange' })
        ),
        lifecycle.onDisconnect(() => this.onLifecycle({ type: 'disconnect' }))
      );
    }
    if (bus.subscriberCount('track-state.snapshot') > 0) this.activate();
  }

  onFrame(frame: Telemetry): void {
    if (!this.processor) return;
    this.metrics.markStart('trackStateProcessing');
    this.processor.onFrame(frame);
    this.metrics.markEnd('trackStateProcessing');
    this.publishIfChanged();
  }

  onSession(session: Session): void {
    this.latestSession = session;
    this.processor?.init(session);
    this.publishIfChanged();
  }

  dispose(): void {
    if (this.processor) {
      this.processor.onLifecycle({ type: 'disconnect' });
      this.publishIfChanged();
    }
    this.deactivate();
    this.disconnects.forEach((disconnect) => disconnect());
  }

  private activate(): void {
    if (this.processor) return;
    this.bus.clearSnapshot('track-state.snapshot');
    this.processor = new TrackStateProcessor();
    this.publishedVersion = -1;
    if (this.latestSession) this.processor.init(this.latestSession);
  }

  private deactivate(): void {
    this.processor = undefined;
    this.publishedVersion = -1;
    this.bus.clearSnapshot('track-state.snapshot');
  }

  private onLifecycle(event: SessionLifecycleEvent): void {
    this.processor?.onLifecycle(event);
    if (this.processor) this.publishIfChanged();
    else this.bus.clearSnapshot('track-state.snapshot');
    if (event.type === 'disconnect') this.latestSession = undefined;
  }

  private publishIfChanged(): void {
    if (!this.processor) return;
    const snapshot = this.processor.snapshot();
    if (snapshot.version === this.publishedVersion) return;
    this.publishedVersion = snapshot.version;
    this.metrics.markStart('trackStatePublication');
    this.bus.publish('track-state.snapshot', snapshot);
    this.metrics.markEnd('trackStatePublication');
  }
}
