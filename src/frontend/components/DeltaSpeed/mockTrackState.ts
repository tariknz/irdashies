import type {
  ChannelName,
  ChannelPayloads,
  TrackStateSnapshot,
} from '@irdashies/types';

/**
 * A complete track-state snapshot with the fields Delta Speed reads overridden.
 *
 * Complete rather than partial because the widget selects individual fields off
 * the snapshot, and a hole in it types as `undefined` at the selector.
 */
export const mockTrackState = (
  overrides: Partial<TrackStateSnapshot> = {}
): TrackStateSnapshot => ({
  focusCarIdx: null,
  carIdxLapDistPct: [],
  carIdxOnPitRoad: [],
  carIdxTrackSurface: [],
  carIdxClassPosition: [],
  carLeftRight: 0,
  isOnTrack: true,
  playerCarInPitStall: false,
  playerTrackSurface: 3,
  onPitRoad: false,
  isInGarage: false,
  isGarageVisible: false,
  isReplayPlaying: false,
  sessionTime: 10,
  sessionState: 4,
  sessionFlags: 0,
  speed: 0,
  displayUnits: 1,
  pitSpeedLimiterToggle: false,
  pitstopActive: false,
  engineWarnings: 0,
  lapDistPct: 0,
  sessionNum: null,
  version: 1,
  ...overrides,
});

/**
 * Installs a `window.channelBridge` that serves one track-state snapshot.
 *
 * A fresh bridge object every call on purpose: the channel snapshot stores are
 * cached in a WeakMap keyed by bridge, so reusing one would carry state from a
 * previous test into the next.
 */
export const seedTrackState = (overrides: Partial<TrackStateSnapshot> = {}) => {
  const payload = mockTrackState(overrides);
  window.channelBridge = {
    subscribe: <K extends ChannelName>(
      channel: K,
      callback: (value: ChannelPayloads[K]) => void
    ) => {
      if (channel === 'track-state.snapshot') {
        callback(payload as ChannelPayloads[K]);
      }
      return () => undefined;
    },
  };
};
