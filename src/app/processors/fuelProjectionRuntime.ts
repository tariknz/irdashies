import type {
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import type { ChannelBus } from '../bridge/channelBridge';
import type { SessionLifecycle } from '../sessionLifecycle';
import { FuelProjectionProcessor } from './FuelProjectionProcessor';

interface PerformanceSections {
  markStart(label: string): void;
  markEnd(label: string): void;
}

interface FuelProjectionRuntimeOptions {
  /** Recorded tapes are chronological and safe to aggregate. */
  aggregateReplay?: boolean;
}

export class FuelProjectionRuntime {
  private processor?: FuelProjectionProcessor;
  private latestSession?: Session;
  private replaySource?: boolean;
  private readonly disconnects: (() => void)[];

  constructor(
    private readonly bus: ChannelBus,
    lifecycle: SessionLifecycle | undefined,
    private readonly metrics: PerformanceSections,
    private readonly options: FuelProjectionRuntimeOptions = {}
  ) {
    this.disconnects = [
      bus.onSubscriberCountChanged((channel, count) => {
        if (channel !== 'fuel.projection') return;
        if (count > 0) this.activate();
        else this.deactivate();
      }),
    ];
    if (lifecycle) {
      this.disconnects.push(
        lifecycle.onEnter(({ replay }) => {
          this.replaySource = replay;
          this.processor?.setSourceReplay(replay);
          this.onLifecycle({
            type: 'enter',
            replay: replay && !this.options.aggregateReplay,
          });
        }),
        lifecycle.onSessionNumChange(() =>
          this.onLifecycle({ type: 'sessionNumChange' })
        ),
        lifecycle.onDisconnect(() => this.onLifecycle({ type: 'disconnect' }))
      );
    }
    if (bus.subscriberCount('fuel.projection') > 0) this.activate();
  }

  onSession(session: Session): void {
    this.latestSession = session;
    this.processor?.init(session);
  }

  onFrame(frame: Telemetry): void {
    if (!this.processor) return;
    this.metrics.markStart('fuelProjectionProcessing');
    this.processor.onFrame(frame);
    this.metrics.markEnd('fuelProjectionProcessing');
    this.metrics.markStart('fuelProjectionPublication');
    this.bus.publish('fuel.projection', this.processor.snapshot());
    this.metrics.markEnd('fuelProjectionPublication');
  }

  dispose(): void {
    if (this.processor) {
      this.processor.onLifecycle({ type: 'disconnect' });
      this.bus.publish('fuel.projection', this.processor.snapshot());
    }
    this.deactivate();
    this.disconnects.forEach((disconnect) => disconnect());
    this.latestSession = undefined;
    this.replaySource = undefined;
  }

  private activate(): void {
    if (this.processor) return;
    this.bus.clearSnapshot('fuel.projection');
    this.processor = new FuelProjectionProcessor({
      sourceReplay: this.replaySource ?? false,
    });
    if (this.replaySource !== undefined) {
      this.processor.onLifecycle({
        type: 'enter',
        replay: this.replaySource && !this.options.aggregateReplay,
      });
    }
    if (this.latestSession) this.processor.init(this.latestSession);
  }

  private deactivate(): void {
    this.processor = undefined;
    this.bus.clearSnapshot('fuel.projection');
  }

  private onLifecycle(event: SessionLifecycleEvent): void {
    this.processor?.onLifecycle(event);
    if (this.processor) {
      this.bus.publish('fuel.projection', this.processor.snapshot());
    } else {
      this.bus.clearSnapshot('fuel.projection');
    }
    if (event.type === 'disconnect') {
      this.latestSession = undefined;
      this.replaySource = undefined;
    }
  }
}
