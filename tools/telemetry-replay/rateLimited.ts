import type { SessionLifecycleEvent, Telemetry } from '@irdashies/types';
import {
  iracingFrameClock,
  takeTick,
  type TickSchedule,
} from '../../src/app/processors/ProcessorHost';

const ranLastFrameBy = new WeakMap<object, boolean>();

/** Whether a rateLimited() processor ran on the last frame it was given. */
export const ranLastFrame = (processor: object): boolean =>
  ranLastFrameBy.get(processor) ?? false;

interface RateLimitedProcessor {
  readonly tickRateHz: number | 'event';
  onFrame(telemetry: Telemetry): void;
  onLifecycle?(event: SessionLifecycleEvent): void;
}

/**
 * Lets tape frames through to processor.onFrame on the processor host's
 * schedule, so a probe records the declared rate rather than one update per
 * tape frame. The tape has every 60 Hz frame; the app may poll fewer. Like the
 * host, it restarts the schedule on every lifecycle event. The probe must
 * request SessionTick, which the iRacing frame clock reads.
 */
export const rateLimited = <P extends RateLimitedProcessor>(
  processor: P
): P => {
  const onFrame = processor.onFrame.bind(processor);
  let schedule: TickSchedule = {};
  const onLifecycle = processor.onLifecycle?.bind(processor);
  if (onLifecycle) {
    processor.onLifecycle = (event: SessionLifecycleEvent) => {
      schedule = {};
      onLifecycle(event);
    };
  }
  processor.onFrame = (telemetry: Telemetry) => {
    const frameTime = iracingFrameClock(telemetry);
    if (frameTime === undefined && processor.tickRateHz !== 'event') {
      // Without a clock every frame would run and the golden would silently
      // record per-frame output again.
      throw new Error(
        'rateLimited: frame has no SessionTick; add it to the probe variables'
      );
    }
    const ran = takeTick(schedule, processor.tickRateHz, frameTime);
    ranLastFrameBy.set(processor, ran);
    if (ran) onFrame(telemetry);
  };
  return processor;
};
