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

export class FuelProjectionRuntime {
  private processor?: FuelProjectionProcessor;
  private latestSession?: Session;
  private replaySource?: boolean;
  private readonly disconnects: (() => void)[];

  constructor(
    private readonly bus: ChannelBus,
    lifecycle: SessionLifecycle,
    private readonly metrics: PerformanceSections
  ) {
    this.disconnects = [
      bus.onSubscriberCountChanged((channel, count) => {
        if (channel !== 'fuel.projection') return;
        if (count > 0) this.activate();
        else this.processor = undefined;
      }),
      lifecycle.onEnter(({ replay }) =>
        this.onLifecycle({ type: 'enter', replay })
      ),
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
    this.metrics.markStart('fuelProjectionProcessing');
    this.processor.onFrame(frame);
    this.metrics.markEnd('fuelProjectionProcessing');
    this.metrics.markStart('fuelProjectionPublication');
    this.bus.publish('fuel.projection', this.processor.snapshot());
    this.metrics.markEnd('fuelProjectionPublication');
  }

  dispose(): void {
    this.disconnects.forEach((disconnect) => disconnect());
    this.processor = undefined;
  }

  private activate(): void {
    if (this.processor) return;
    this.processor = new FuelProjectionProcessor();
    if (this.replaySource !== undefined) {
      this.processor.onLifecycle({
        type: 'enter',
        replay: this.replaySource,
      });
    }
    if (this.latestSession) this.processor.init(this.latestSession);
  }

  private onLifecycle(event: SessionLifecycleEvent): void {
    if (event.type === 'enter') this.replaySource = event.replay;
    this.processor?.onLifecycle(event);
    if (event.type === 'disconnect') {
      this.latestSession = undefined;
      this.replaySource = undefined;
    }
  }
}
