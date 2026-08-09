import type { ChannelBridge, TrackStateSnapshot } from '@irdashies/types';
import {
  useChannelSelector,
  useChannelSnapshot,
  type ChannelSelectorOptions,
} from './useChannelSnapshot';

export const trackStateSelectors = {
  carIdxLapDistPct: (snapshot: TrackStateSnapshot) => snapshot.carIdxLapDistPct,
  carIdxOnPitRoad: (snapshot: TrackStateSnapshot) => snapshot.carIdxOnPitRoad,
  carIdxTrackSurface: (snapshot: TrackStateSnapshot) =>
    snapshot.carIdxTrackSurface,
  displayUnits: (snapshot: TrackStateSnapshot) => snapshot.displayUnits,
  focusCarIdx: (snapshot: TrackStateSnapshot) => snapshot.focusCarIdx,
  isOnTrack: (snapshot: TrackStateSnapshot) => snapshot.isOnTrack,
  lapDistPct: (snapshot: TrackStateSnapshot) => snapshot.lapDistPct,
  sessionFlags: (snapshot: TrackStateSnapshot) => snapshot.sessionFlags,
  sessionNum: (snapshot: TrackStateSnapshot) => snapshot.sessionNum,
  speed: (snapshot: TrackStateSnapshot) => snapshot.speed,
} as const;

export const useTrackStateSelector = <Selected>(
  selector: (snapshot: TrackStateSnapshot) => Selected,
  options: ChannelSelectorOptions<Selected> = {}
) => useChannelSelector('track-state.snapshot', selector, options);

export const useTrackStateSnapshot = (enabled = true, bridge?: ChannelBridge) =>
  useChannelSnapshot('track-state.snapshot', undefined, bridge, enabled);
