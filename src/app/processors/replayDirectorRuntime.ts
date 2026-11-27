import type { Session, Telemetry } from '@irdashies/types';
import type { ChannelBus } from '../bridge/channelBus';
import type { SessionLifecycle } from '../sessionLifecycle';
import { ReplayTimecodeProcessor } from './ReplayTimecodeProcessor';
import { getCurrentBridge, onBridgeChanged } from '../bridge/iracingSdk/setup';
import logger from '../logger';

const CHANNEL = 'replay.timecode';

/**
 * Hosts ReplayTimecodeProcessor outside ProcessorHost.
 * Inactive (emits no snapshots) while a tape replay is loaded.
 */
export class ReplayDirectorRuntime {
  private readonly processor: ReplayTimecodeProcessor;
  private subscribers = 0;
  private driverInfo: Session['DriverInfo'] | undefined;
  private readonly disconnects: (() => void)[] = [];

  constructor(
    private readonly bus: ChannelBus,
    lifecycle: SessionLifecycle,
    private readonly getTapeReplayStatus: () => unknown
  ) {
    this.processor = new ReplayTimecodeProcessor();

    this.disconnects.push(
      lifecycle.onEnter(() => this.processor.onLifecycle({ type: 'enter' })),
      lifecycle.onDisconnect(() =>
        this.processor.onLifecycle({ type: 'disconnect' })
      ),
      bus.onSubscriberCountChanged((channel, count) => {
        if (channel !== CHANNEL) return;
        const gained = count > 0 && this.subscribers === 0;
        this.subscribers = count;
        if (gained) this.bus.publish(CHANNEL, this.processor.snapshot());
      })
    );

    this.wireSource();
    this.disconnects.push(onBridgeChanged(() => this.wireSource()));
  }

  private wireSource(): void {
    this.driverInfo = undefined;
    const bridge = getCurrentBridge();
    if (!bridge) return;

    this.disconnects.push(
      bridge.onSessionData((session) => {
        this.driverInfo = session.DriverInfo;
        this.processor.onSession();
      }) ?? (() => undefined),
      bridge.onTelemetry((telemetry: Telemetry) => {
        if (this.isInactive()) return;
        const changed = this.processor.onFrame(telemetry);
        if (changed) this.bus.publish(CHANNEL, this.processor.snapshot());
      }) ?? (() => undefined)
    );
  }

  private isInactive(): boolean {
    return this.getTapeReplayStatus() !== null;
  }

  cut(): void {
    if (this.isInactive()) return;
    this.processor.cut();
    this.bus.publish(CHANNEL, this.processor.snapshot());
  }

  async backToProgram(): Promise<void> {
    if (this.isInactive()) return;
    const target = this.processor.programTarget();
    const bridge = getCurrentBridge();
    if (!bridge) return;

    if (target === null) {
      logger.info('[ReplayDirector] backToProgram: already on program');
      return;
    }

    const snap = this.processor.snapshot();
    this.processor.expectProgrammaticSeek();
    if (snap.atLiveEdge) {
      logger.info('[ReplayDirector] backToProgram: live edge — seeking to end');
      bridge.changeReplaySpeed(1, false);
      bridge.triggerReplaySessionSearch(
        target.sessionNum,
        target.sessionTime * 1000
      );
    } else {
      logger.info(
        `[ReplayDirector] backToProgram: seeking to frame ${target.frame} sessionTime ${target.sessionTime}`
      );
      bridge.changeReplaySpeed(1, false);
      bridge.triggerReplaySessionSearch(
        target.sessionNum,
        target.sessionTime * 1000
      );
    }

    this.processor.returned({
      sessionNum: target.sessionNum,
      sessionTime: target.sessionTime,
      playSpeed: 1,
      slowMotion: false,
    });
    this.bus.publish(CHANNEL, this.processor.snapshot());
  }

  async resumeAtCut(): Promise<void> {
    if (this.isInactive()) return;
    const cue = this.processor.getCue();
    const bridge = getCurrentBridge();
    if (!bridge || !cue) return;

    logger.info(
      `[ReplayDirector] resumeAtCut: seeking to cue frame ${cue.frame}`
    );
    this.processor.expectProgrammaticSeek();
    bridge.changeReplaySpeed(cue.playSpeed, cue.slowMotion);
    bridge.triggerReplaySessionSearch(cue.sessionNum, cue.sessionTime * 1000);
    const driver = this.driverInfo?.Drivers.find(
      (driver) => driver.CarIdx === cue.camCarIdx
    );
    if (driver?.CarNumber) {
      bridge.changeCameraNumber(
        driver.CarNumber,
        cue.camGroupNum,
        cue.camCameraNum
      );
    }

    this.processor.returned({
      sessionNum: cue.sessionNum,
      sessionTime: cue.sessionTime,
      playSpeed: cue.playSpeed,
      slowMotion: cue.slowMotion,
    });
    this.bus.publish(CHANNEL, this.processor.snapshot());
  }

  async stayHere(): Promise<void> {
    if (this.isInactive()) return;
    this.processor.returned();
    this.bus.publish(CHANNEL, this.processor.snapshot());
  }

  dispose(): void {
    this.disconnects.forEach((d) => d());
    this.disconnects.length = 0;
  }
}
