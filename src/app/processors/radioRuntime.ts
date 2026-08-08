import type { SessionLifecycleEvent, Telemetry } from '@irdashies/types';
import type { ChannelBus } from '../bridge/channelBridge';
import type { SessionLifecycle } from '../sessionLifecycle';
import { RadioProcessor } from './RadioProcessor';

interface PerformanceSections {
  markStart(label: string): void;
  markEnd(label: string): void;
}

export class RadioRuntime {
  private processor?: RadioProcessor;
  private replaySource?: boolean;
  private publishedVersion = -1;
  private readonly disconnects: (() => void)[];

  constructor(
    private readonly bus: ChannelBus,
    lifecycle: SessionLifecycle | undefined,
    private readonly metrics: PerformanceSections,
    private readonly aggregateReplay = false
  ) {
    this.disconnects = [
      bus.onSubscriberCountChanged((channel, count) => {
        if (channel !== 'radio.snapshot') return;
        if (count > 0) this.activate();
        else this.deactivate();
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
    if (bus.subscriberCount('radio.snapshot') > 0) this.activate();
  }

  onFrame(frame: Telemetry): void {
    if (!this.processor) return;
    this.metrics.markStart('radioProcessing');
    this.processor.onFrame(frame);
    this.metrics.markEnd('radioProcessing');
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
    this.bus.clearSnapshot('radio.snapshot');
    this.processor = new RadioProcessor();
    this.publishedVersion = -1;
    if (this.replaySource !== undefined) {
      this.processor.onLifecycle({
        type: 'enter',
        replay: this.replaySource && !this.aggregateReplay,
      });
    }
  }

  private deactivate(): void {
    this.processor = undefined;
    this.publishedVersion = -1;
    this.bus.clearSnapshot('radio.snapshot');
  }

  private onLifecycle(event: SessionLifecycleEvent): void {
    this.processor?.onLifecycle(event);
    if (this.processor) this.publishIfChanged();
    else this.bus.clearSnapshot('radio.snapshot');
    if (event.type === 'disconnect') this.replaySource = undefined;
  }

  private publishIfChanged(): void {
    if (!this.processor) return;
    const snapshot = this.processor.snapshot();
    if (snapshot.version === this.publishedVersion) return;
    this.publishedVersion = snapshot.version;
    this.metrics.markStart('radioPublication');
    this.bus.publish('radio.snapshot', snapshot);
    this.metrics.markEnd('radioPublication');
  }
}
