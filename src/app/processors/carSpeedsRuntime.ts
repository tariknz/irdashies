import type {
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import type { ChannelBus } from '../bridge/channelBridge';
import type { SessionLifecycle } from '../sessionLifecycle';
import { CarSpeedsProcessor } from './CarSpeedsProcessor';

interface PerformanceSections {
  markStart(label: string): void;
  markEnd(label: string): void;
}

export class CarSpeedsRuntime {
  private processor?: CarSpeedsProcessor;
  private latestSession?: Session;
  private replaySource?: boolean;
  private publishedVersion = -1;
  private readonly disconnects: (() => void)[];

  constructor(
    private readonly bus: ChannelBus,
    lifecycle: SessionLifecycle,
    private readonly metrics: PerformanceSections,
    private readonly aggregateReplay = false
  ) {
    this.disconnects = [
      bus.onSubscriberCountChanged((channel, count) => {
        if (channel !== 'car-speeds.snapshot') return;
        if (count > 0) this.activate();
        else this.processor = undefined;
      }),
      lifecycle.onEnter(({ replay }) => {
        this.replaySource = replay;
        this.onLifecycle({
          type: 'enter',
          replay: replay && !this.aggregateReplay,
        });
      }),
      lifecycle.onSessionNumChange(() =>
        this.onLifecycle({ type: 'sessionNumChange' })
      ),
      lifecycle.onDisconnect(() => this.onLifecycle({ type: 'disconnect' })),
    ];
  }

  onSession(session: Session): void {
    this.latestSession = session;
    this.processor?.init(session);
  }

  onFrame(frame: Telemetry): void {
    if (!this.processor) return;
    this.metrics.markStart('carSpeedsProcessing');
    this.processor.onFrame(frame);
    this.metrics.markEnd('carSpeedsProcessing');
    const snapshot = this.processor.snapshot();
    if (snapshot.version === this.publishedVersion) return;
    this.publishedVersion = snapshot.version;
    this.metrics.markStart('carSpeedsPublication');
    this.bus.publish('car-speeds.snapshot', snapshot);
    this.metrics.markEnd('carSpeedsPublication');
  }

  dispose(): void {
    this.disconnects.forEach((disconnect) => disconnect());
    this.processor = undefined;
  }

  private activate(): void {
    if (this.processor) return;
    this.bus.clearSnapshot('car-speeds.snapshot');
    this.processor = new CarSpeedsProcessor();
    this.publishedVersion = -1;
    if (this.latestSession) this.processor.init(this.latestSession);
    if (this.replaySource !== undefined) {
      this.processor.onLifecycle({
        type: 'enter',
        replay: this.replaySource && !this.aggregateReplay,
      });
    }
  }

  private onLifecycle(event: SessionLifecycleEvent): void {
    this.processor?.onLifecycle(event);
    if (this.processor) {
      const snapshot = this.processor.snapshot();
      this.bus.publish('car-speeds.snapshot', snapshot);
      this.publishedVersion = snapshot.version;
    } else {
      this.bus.clearSnapshot('car-speeds.snapshot');
      this.publishedVersion = -1;
    }
    if (event.type === 'disconnect') {
      this.latestSession = undefined;
      this.replaySource = undefined;
    }
  }
}
