import type { ChannelBridge } from '@irdashies/types';
import { useChannelSnapshot } from './useChannelSnapshot';

export const useTrackStateSnapshot = (
  enabled = true,
  bridge?: ChannelBridge
) => useChannelSnapshot('track-state.snapshot', undefined, bridge, enabled);
