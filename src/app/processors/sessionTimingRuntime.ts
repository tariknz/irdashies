import type {
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import type { ChannelBus } from '../bridge/channelBridge';
import type { SessionLifecycle } from '../sessionLifecycle';
import { SessionTimingProcessor } from './SessionTimingProcessor';
import type { LapTimesRuntime } from './lapTimesRuntime';

interface PerformanceSections {
  markStart(label: string): void;
  markEnd(label: string): void;
}

export class SessionTimingRuntime {
  private processor?: SessionTimingProcessor;
  private latestSession?: Session;
  private replaySource?: boolean;
  private publishedVersion = -1;
  private releaseLapTimes?: () => void;
  private readonly disconnects: (() => void)[];

  constructor(
    private readonly bus: ChannelBus,
    lifecycle: SessionLifecycle | undefined,
    private readonly metrics: PerformanceSections,
    private readonly lapTimesRuntime: LapTimesRuntime,
    private readonly aggregateReplay = false
  ) {
    this.disconnects = [
      bus.onSubscriberCountChanged((channel, count) => {
        if (channel !== 'session-timing.snapshot') return;
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
    if (bus.subscriberCount('session-timing.snapshot') > 0) this.activate();
  }

  onSession(session: Session): void {
    this.latestSession = session;
    this.processor?.init(session);
  }

  onFrame(frame: Telemetry): void {
    if (!this.processor) return;
    this.metrics.markStart('sessionTimingProcessing');
    this.processor.onFrame(frame);
    this.metrics.markEnd('sessionTimingProcessing');
    this.publishIfChanged();
  }

  dispose(): void {
    if (this.processor) {
      this.processor.onLifecycle({ type: 'disconnect' });
      this.bus.publish('session-timing.snapshot', this.processor.snapshot());
    }
    this.deactivate();
    this.disconnects.forEach((disconnect) => disconnect());
  }

  private activate(): void {
    if (this.processor) return;
    this.bus.clearSnapshot('session-timing.snapshot');
    this.releaseLapTimes = this.lapTimesRuntime.acquire();
    this.processor = new SessionTimingProcessor(
      () => this.lapTimesRuntime.snapshot()?.lapTimes ?? []
    );
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
    this.releaseLapTimes?.();
    this.releaseLapTimes = undefined;
    this.publishedVersion = -1;
    this.bus.clearSnapshot('session-timing.snapshot');
  }

  private onLifecycle(event: SessionLifecycleEvent): void {
    this.processor?.onLifecycle(event);
    if (this.processor) this.publishIfChanged();
    else this.bus.clearSnapshot('session-timing.snapshot');
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
    this.metrics.markStart('sessionTimingPublication');
    this.bus.publish('session-timing.snapshot', snapshot);
    this.metrics.markEnd('sessionTimingPublication');
  }
}
