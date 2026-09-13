import type { ChannelBridge } from '@irdashies/types';
import { useChannelSnapshot } from './useChannelSnapshot';

export const useCarSystemsSnapshot = (enabled = true, bridge?: ChannelBridge) =>
  useChannelSnapshot('car-systems.snapshot', undefined, bridge, enabled);
