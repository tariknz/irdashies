import type { SessionLifecycleEvent, Telemetry } from '@irdashies/types';
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
  private readonly disconnects: (() => void)[];

  constructor(
    private readonly bus: ChannelBus,
    lifecycle: SessionLifecycle,
    private readonly metrics: PerformanceSections,
    private readonly aggregateReplay = false
  ) {
    this.disconnects = [
      bus.onSubscriberCountChanged((channel, count) => {
        if (channel !== 'lap-times.snapshot') return;
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

  onFrame(frame: Telemetry): void {
    if (!this.processor) return;
    this.metrics.markStart('lapTimesProcessing');
    this.processor.onFrame(frame);
    this.metrics.markEnd('lapTimesProcessing');
    const snapshot = this.processor.snapshot();
    if (snapshot.version === this.publishedVersion) return;
    this.publishedVersion = snapshot.version;
    this.metrics.markStart('lapTimesPublication');
    this.bus.publish('lap-times.snapshot', snapshot);
    this.metrics.markEnd('lapTimesPublication');
  }

  dispose(): void {
    this.disconnects.forEach((disconnect) => disconnect());
    this.processor = undefined;
  }

  private activate(): void {
    if (this.processor) return;
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
