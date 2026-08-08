import type {
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import type { ChannelBus } from '../bridge/channelBridge';
import type { SessionLifecycle } from '../sessionLifecycle';
import {
  ReferenceLapProcessor,
  type ReferenceLapPersistence,
} from './ReferenceLapProcessor';

interface PerformanceSections {
  markStart(label: string): void;
  markEnd(label: string): void;
}

export class ReferenceLapRuntime {
  private processor?: ReferenceLapProcessor;
  private latestSession?: Session;
  private replaySource?: boolean;
  private hasSubscribers: boolean;
  private publishedVersion = -1;
  private readonly disconnects: (() => void)[];

  constructor(
    private readonly bus: ChannelBus,
    lifecycle: SessionLifecycle | undefined,
    private readonly metrics: PerformanceSections,
    private readonly persistence: ReferenceLapPersistence,
    private readonly aggregateReplay = false
  ) {
    this.hasSubscribers = bus.subscriberCount('reference-laps.snapshot') > 0;
    this.disconnects = [
      bus.onSubscriberCountChanged((channel, count) => {
        if (channel !== 'reference-laps.snapshot') return;
        this.hasSubscribers = count > 0;
        if (this.hasSubscribers) {
          if (this.processor) {
            this.publishedVersion = -1;
            this.publishIfChanged();
          } else {
            this.activate();
          }
        } else {
          this.bus.clearSnapshot('reference-laps.snapshot');
          this.publishedVersion = -1;
        }
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
    if (this.hasSubscribers) this.activate();
  }

  onSession(session: Session): void {
    this.latestSession = session;
    this.processor?.init(session);
    this.publishIfChanged();
  }

  onFrame(frame: Telemetry): void {
    if (!this.processor || !this.hasSubscribers) return;
    this.metrics.markStart('referenceLapProcessing');
    this.processor.onFrame(frame);
    this.metrics.markEnd('referenceLapProcessing');
    this.publishIfChanged();
  }

  dispose(): void {
    if (this.processor) {
      this.processor.onLifecycle({ type: 'disconnect' });
      this.bus.publish('reference-laps.snapshot', this.processor.snapshot());
    }
    this.bus.clearSnapshot('reference-laps.snapshot');
    this.disconnects.forEach((disconnect) => disconnect());
    this.processor = undefined;
  }

  private activate(): void {
    if (this.processor) return;
    this.bus.clearSnapshot('reference-laps.snapshot');
    this.processor = new ReferenceLapProcessor(
      this.aggregateReplay
        ? { load: () => null, save: () => undefined }
        : this.persistence
    );
    this.publishedVersion = -1;
    if (this.latestSession) this.processor.init(this.latestSession);
    if (this.replaySource !== undefined) {
      this.processor.onLifecycle({
        type: 'enter',
        replay: this.replaySource && !this.aggregateReplay,
      });
    }
    this.publishIfChanged();
  }

  private onLifecycle(event: SessionLifecycleEvent): void {
    this.processor?.onLifecycle(event);
    this.publishIfChanged();
    if (event.type === 'disconnect') {
      this.latestSession = undefined;
      this.replaySource = undefined;
    }
  }

  private publishIfChanged(): void {
    if (!this.processor || !this.hasSubscribers) return;
    const snapshot = this.processor.snapshot();
    if (snapshot.version === this.publishedVersion) return;
    this.publishedVersion = snapshot.version;
    this.metrics.markStart('referenceLapPublication');
    this.bus.publish('reference-laps.snapshot', snapshot);
    this.metrics.markEnd('referenceLapPublication');
  }
}
