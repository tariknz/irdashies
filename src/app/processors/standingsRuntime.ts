import type {
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import type { ChannelBus } from '../bridge/channelBridge';
import type { SessionLifecycle } from '../sessionLifecycle';
import { StandingsProcessor } from './StandingsProcessor';

interface PerformanceSections {
  markStart(label: string): void;
  markEnd(label: string): void;
}

export class StandingsRuntime {
  private processor?: StandingsProcessor;
  private latestSession?: Session;
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
        if (channel !== 'standings.snapshot') return;
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
    if (bus.subscriberCount('standings.snapshot') > 0) this.activate();
  }

  onSession(session: Session): void {
    this.latestSession = session;
    this.processor?.init(session);
  }

  onFrame(frame: Telemetry): void {
    if (!this.processor) return;
    this.metrics.markStart('standingsProcessing');
    this.processor.onFrame(frame);
    this.metrics.markEnd('standingsProcessing');
    this.publishIfChanged();
  }

  dispose(): void {
    if (this.processor) {
      this.processor.onLifecycle({ type: 'disconnect' });
      this.bus.publish('standings.snapshot', this.processor.snapshot());
    }
    this.deactivate();
    this.disconnects.forEach((disconnect) => disconnect());
  }

  private activate(): void {
    if (this.processor) return;
    this.bus.clearSnapshot('standings.snapshot');
    this.processor = new StandingsProcessor();
    this.publishedVersion = -1;
    if (this.latestSession) this.processor.init(this.latestSession);
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
    this.bus.clearSnapshot('standings.snapshot');
  }

  private onLifecycle(event: SessionLifecycleEvent): void {
    this.processor?.onLifecycle(event);
    if (this.processor) this.publishIfChanged();
    else this.bus.clearSnapshot('standings.snapshot');
    if (event.type === 'disconnect') {
      this.latestSession = undefined;
      this.replaySource = undefined;
    }
  }

  private publishIfChanged(): void {
    if (!this.processor) return;
    const snapshot = this.processor.snapshot();
    if (snapshot.version === this.publishedVersion) return;
    this.publishedVersion = snapshot.version;
    this.metrics.markStart('standingsPublication');
    this.bus.publish('standings.snapshot', snapshot);
    this.metrics.markEnd('standingsPublication');
  }
}
