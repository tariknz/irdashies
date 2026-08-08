import type {
  Session,
  SessionLifecycleEvent,
  Telemetry,
} from '@irdashies/types';
import type { ChannelBus } from '../bridge/channelBridge';
import type { SessionLifecycle } from '../sessionLifecycle';
import { DriverControlsProcessor } from './DriverControlsProcessor';

interface PerformanceSections {
  markStart(label: string): void;
  markEnd(label: string): void;
}

export class DriverControlsRuntime {
  private processor?: DriverControlsProcessor;
  private latestSession?: Session;
  private publishedVersion = -1;
  private readonly disconnects: (() => void)[];

  constructor(
    private readonly bus: ChannelBus,
    lifecycle: SessionLifecycle | undefined,
    private readonly metrics: PerformanceSections
  ) {
    this.disconnects = [
      bus.onSubscriberCountChanged((channel, count) => {
        if (channel !== 'driver-controls.snapshot') return;
        if (count > 0) this.activate();
        else this.deactivate();
      }),
    ];
    if (lifecycle) {
      this.disconnects.push(
        lifecycle.onSessionNumChange(() =>
          this.onLifecycle({ type: 'sessionNumChange' })
        ),
        lifecycle.onDisconnect(() => this.onLifecycle({ type: 'disconnect' }))
      );
    }
    if (bus.subscriberCount('driver-controls.snapshot') > 0) this.activate();
  }

  onFrame(frame: Telemetry): void {
    if (!this.processor) return;
    this.metrics.markStart('driverControlsProcessing');
    this.processor.onFrame(frame);
    this.metrics.markEnd('driverControlsProcessing');
    this.publishIfChanged();
  }

  onSession(session: Session): void {
    this.latestSession = session;
    this.processor?.init(session);
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
    this.bus.clearSnapshot('driver-controls.snapshot');
    this.processor = new DriverControlsProcessor();
    this.publishedVersion = -1;
    if (this.latestSession) this.processor.init(this.latestSession);
  }

  private deactivate(): void {
    this.processor = undefined;
    this.publishedVersion = -1;
    this.bus.clearSnapshot('driver-controls.snapshot');
  }

  private onLifecycle(event: SessionLifecycleEvent): void {
    this.processor?.onLifecycle(event);
    if (this.processor) this.publishIfChanged();
    else this.bus.clearSnapshot('driver-controls.snapshot');
    if (event.type === 'disconnect') this.latestSession = undefined;
  }

  private publishIfChanged(): void {
    if (!this.processor) return;
    const snapshot = this.processor.snapshot();
    if (snapshot.version === this.publishedVersion) return;
    this.publishedVersion = snapshot.version;
    this.metrics.markStart('driverControlsPublication');
    this.bus.publish('driver-controls.snapshot', snapshot);
    this.metrics.markEnd('driverControlsPublication');
  }
}
