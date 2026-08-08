import type { ChannelBridge } from '@irdashies/types';
import { useChannelSnapshot } from './useChannelSnapshot';

export const useCarSpeedsSnapshot = (enabled = true, bridge?: ChannelBridge) =>
  useChannelSnapshot('car-speeds.snapshot', undefined, bridge, enabled);
