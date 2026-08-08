import type {
  ReferenceLapsSnapshot,
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import type { ChannelBus } from '../bridge/channelBridge';
import type { SessionLifecycle } from '../sessionLifecycle';
import { RelativeGapProcessor } from './RelativeGapProcessor';

interface PerformanceSections {
  markStart(label: string): void;
  markEnd(label: string): void;
}

interface ReferenceLapRuntimeSource {
  acquireConsumer(): () => void;
  snapshot(): ReferenceLapsSnapshot | undefined;
}

const EMPTY_REFERENCES: ReferenceLapsSnapshot = {
  bestLaps: [],
  persistedLaps: [],
  sessionNum: null,
  version: 0,
};

export class RelativeGapRuntime {
  private processor?: RelativeGapProcessor;
  private latestSession?: Session;
  private replaySource?: boolean;
  private releaseReferenceLaps?: () => void;
  private publishedVersion = -1;
  private readonly disconnects: (() => void)[];

  constructor(
    private readonly bus: ChannelBus,
    lifecycle: SessionLifecycle | undefined,
    private readonly metrics: PerformanceSections,
    private readonly referenceLaps: ReferenceLapRuntimeSource,
    private readonly aggregateReplay = false
  ) {
    this.disconnects = [
      bus.onSubscriberCountChanged((channel, count) => {
        if (channel !== 'relative-gaps.snapshot') return;
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
    if (bus.subscriberCount('relative-gaps.snapshot') > 0) this.activate();
  }

  onSession(session: Session): void {
    this.latestSession = session;
    this.processor?.init(session);
  }

  onFrame(frame: Telemetry): void {
    if (!this.processor) return;
    this.metrics.markStart('relativeGapProcessing');
    this.processor.onFrame(frame);
    this.metrics.markEnd('relativeGapProcessing');
    this.publishIfChanged();
  }

  dispose(): void {
    if (this.processor) {
      this.processor.onLifecycle({ type: 'disconnect' });
      this.bus.publish('relative-gaps.snapshot', this.processor.snapshot());
    }
    this.deactivate();
    this.disconnects.forEach((disconnect) => disconnect());
  }

  private activate(): void {
    if (this.processor) return;
    this.bus.clearSnapshot('relative-gaps.snapshot');
    this.releaseReferenceLaps = this.referenceLaps.acquireConsumer();
    this.processor = new RelativeGapProcessor({
      snapshot: () => this.referenceLaps.snapshot() ?? EMPTY_REFERENCES,
    });
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
    this.releaseReferenceLaps?.();
    this.releaseReferenceLaps = undefined;
    this.processor = undefined;
    this.publishedVersion = -1;
    this.bus.clearSnapshot('relative-gaps.snapshot');
  }

  private onLifecycle(event: SessionLifecycleEvent): void {
    this.processor?.onLifecycle(event);
    if (this.processor) this.publishIfChanged();
    else this.bus.clearSnapshot('relative-gaps.snapshot');
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
    this.metrics.markStart('relativeGapPublication');
    this.bus.publish('relative-gaps.snapshot', snapshot);
    this.metrics.markEnd('relativeGapPublication');
  }
}
