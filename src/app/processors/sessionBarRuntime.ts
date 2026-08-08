import type {
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import type { ChannelBus } from '../bridge/channelBridge';
import type { SessionLifecycle } from '../sessionLifecycle';
import { SessionBarProcessor } from './SessionBarProcessor';

interface Metrics {
  markStart(label: string): void;
  markEnd(label: string): void;
}
export class SessionBarRuntime {
  private processor?: SessionBarProcessor;
  private session?: Session;
  private replay?: boolean;
  private published = -1;
  private readonly disconnects: (() => void)[];
  constructor(
    private readonly bus: ChannelBus,
    lifecycle: SessionLifecycle | undefined,
    private readonly metrics: Metrics,
    private readonly aggregateReplay = false
  ) {
    this.disconnects = [
      bus.onSubscriberCountChanged((channel, count) => {
        if (channel !== 'session-bar.snapshot') return;
        if (count) this.activate();
        else this.deactivate();
      }),
    ];
    if (lifecycle)
      this.disconnects.push(
        lifecycle.onEnter(({ replay }) => {
          this.replay = replay;
          this.lifecycle({
            type: 'enter',
            replay: replay && !this.aggregateReplay,
          });
        }),
        lifecycle.onSessionNumChange(() =>
          this.lifecycle({ type: 'sessionNumChange' })
        ),
        lifecycle.onDisconnect(() => this.lifecycle({ type: 'disconnect' }))
      );
    if (bus.subscriberCount('session-bar.snapshot')) this.activate();
  }
  onSession(session: Session): void {
    this.session = session;
    this.processor?.init(session);
  }
  onFrame(frame: Telemetry): void {
    if (!this.processor) return;
    this.metrics.markStart('sessionBarProcessing');
    this.processor.onFrame(frame);
    this.metrics.markEnd('sessionBarProcessing');
    this.publish();
  }
  dispose(): void {
    if (this.processor) {
      this.processor.onLifecycle({ type: 'disconnect' });
      this.bus.publish('session-bar.snapshot', this.processor.snapshot());
    }
    this.deactivate();
    this.disconnects.forEach((d) => d());
  }
  private activate(): void {
    if (this.processor) return;
    this.bus.clearSnapshot('session-bar.snapshot');
    this.processor = new SessionBarProcessor();
    this.published = -1;
    if (this.session) this.processor.init(this.session);
    if (this.replay !== undefined)
      this.processor.onLifecycle({
        type: 'enter',
        replay: this.replay && !this.aggregateReplay,
      });
  }
  private deactivate(): void {
    this.processor = undefined;
    this.published = -1;
    this.bus.clearSnapshot('session-bar.snapshot');
  }
  private lifecycle(event: SessionLifecycleEvent): void {
    this.processor?.onLifecycle(event);
    this.publish();
    if (event.type === 'disconnect') {
      this.session = undefined;
      this.replay = undefined;
    }
  }
  private publish(): void {
    if (!this.processor) return;
    if (this.processor.snapshotVersion() === this.published) return;
    const snapshot = this.processor.snapshot();
    this.published = snapshot.version;
    this.metrics.markStart('sessionBarPublication');
    this.bus.publish('session-bar.snapshot', snapshot);
    this.metrics.markEnd('sessionBarPublication');
  }
}
