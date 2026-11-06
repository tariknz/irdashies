import type { ChannelBridge } from '@irdashies/types';
import { useChannelSnapshot } from './useChannelSnapshot';

export const usePitStopsSnapshot = (enabled = true, bridge?: ChannelBridge) =>
  useChannelSnapshot('pit-stops.snapshot', undefined, bridge, enabled);
