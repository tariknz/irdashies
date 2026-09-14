import type { ChannelBridge, LapTraceSampleSnapshot } from '@irdashies/types';
import {
  useChannelSelector,
  useChannelSnapshot,
  type ChannelSelectorOptions,
} from './useChannelSnapshot';

export const lapTraceSampleSelectors = {
  brake: (snapshot: LapTraceSampleSnapshot) => snapshot.brake,
  lapDistPct: (snapshot: LapTraceSampleSnapshot) => snapshot.lapDistPct,
  sessionNum: (snapshot: LapTraceSampleSnapshot) => snapshot.sessionNum,
  sessionTime: (snapshot: LapTraceSampleSnapshot) => snapshot.sessionTime,
  speed: (snapshot: LapTraceSampleSnapshot) => snapshot.speed,
  throttle: (snapshot: LapTraceSampleSnapshot) => snapshot.throttle,
} as const;

export const useLapTraceSampleSelector = <Selected>(
  selector: (snapshot: LapTraceSampleSnapshot) => Selected,
  options: ChannelSelectorOptions<Selected> = {}
) => useChannelSelector('lap-trace.sample', selector, options);

/**
 * The LapTrace recorder's co-sampled 60 Hz frame. The recorder itself
 * subscribes to the store directly (it runs at telemetry rate, R2.3); this
 * hook is the React-side entry point for anything that wants the odd field.
 */
export const useLapTraceSampleSnapshot = (
  enabled = true,
  bridge?: ChannelBridge
) => useChannelSnapshot('lap-trace.sample', undefined, bridge, enabled);
