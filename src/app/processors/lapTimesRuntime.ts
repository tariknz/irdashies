import type {
  LapTimesSnapshot,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import type { ChannelBus } from '../bridge/channelBridge';
import type { SessionLifecycle } from '../sessionLifecycle';
import { LapTimesProcessor } from './LapTimesProcessor';

interface PerformanceSections {
  markStart(label: string): void;
  markEnd(label: string): void;
}

export class LapTimesRuntime {
  private processor?: LapTimesProcessor;
  private replaySource?: boolean;
  private publishedVersion = -1;
  private externalConsumers = 0;
  private readonly disconnects: (() => void)[];

  constructor(
    private readonly bus: ChannelBus,
    lifecycle: SessionLifecycle | undefined,
    private readonly metrics: PerformanceSections,
    private readonly aggregateReplay = false
  ) {
    this.disconnects = [
      bus.onSubscriberCountChanged((channel, count) => {
        if (channel !== 'lap-times.snapshot') return;
        if (count > 0) this.activate();
        else this.deactivateIfUnused();
      }),
    ];
    if (lifecycle) {
      this.disconnects.push(
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
        lifecycle.onDisconnect(() => this.onLifecycle({ type: 'disconnect' }))
      );
    }
    if (bus.subscriberCount('lap-times.snapshot') > 0) this.activate();
  }

  onFrame(frame: Telemetry): void {
    if (!this.processor) return;
    this.metrics.markStart('lapTimesProcessing');
    this.processor.onFrame(frame);
    this.metrics.markEnd('lapTimesProcessing');
    const snapshot = this.processor.snapshot();
    if (snapshot.version === this.publishedVersion) return;
    if (this.bus.subscriberCount('lap-times.snapshot') === 0) return;
    this.publishedVersion = snapshot.version;
    this.metrics.markStart('lapTimesPublication');
    this.bus.publish('lap-times.snapshot', snapshot);
    this.metrics.markEnd('lapTimesPublication');
  }

  dispose(): void {
    this.disconnects.forEach((disconnect) => disconnect());
    this.processor = undefined;
  }

  acquire(): () => void {
    this.externalConsumers += 1;
    this.activate();
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.externalConsumers -= 1;
      this.deactivateIfUnused();
    };
  }

  snapshot(): LapTimesSnapshot | undefined {
    return this.processor?.snapshot();
  }

  private activate(): void {
    if (this.processor) {
      if (this.bus.subscriberCount('lap-times.snapshot') > 0) {
        const snapshot = this.processor.snapshot();
        this.bus.publish('lap-times.snapshot', snapshot);
        this.publishedVersion = snapshot.version;
      }
      return;
    }
    this.bus.clearSnapshot('lap-times.snapshot');
    this.processor = new LapTimesProcessor();
    this.publishedVersion = -1;
    if (this.replaySource !== undefined) {
      this.processor.onLifecycle({
        type: 'enter',
        replay: this.replaySource && !this.aggregateReplay,
      });
    }
  }

  private deactivateIfUnused(): void {
    if (
      this.externalConsumers === 0 &&
      this.bus.subscriberCount('lap-times.snapshot') === 0
    ) {
      this.processor = undefined;
      this.publishedVersion = -1;
      this.bus.clearSnapshot('lap-times.snapshot');
    }
  }

  private onLifecycle(event: SessionLifecycleEvent): void {
    this.processor?.onLifecycle(event);
    if (this.processor) {
      const snapshot = this.processor.snapshot();
      this.bus.publish('lap-times.snapshot', snapshot);
      this.publishedVersion = snapshot.version;
    } else {
      this.bus.clearSnapshot('lap-times.snapshot');
      this.publishedVersion = -1;
    }
    if (event.type === 'disconnect') this.replaySource = undefined;
  }
}
