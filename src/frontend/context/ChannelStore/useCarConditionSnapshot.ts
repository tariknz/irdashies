import type { ChannelBridge } from '@irdashies/types';
import { useChannelSnapshot } from './useChannelSnapshot';

export const useCarConditionSnapshot = (
  enabled = true,
  bridge?: ChannelBridge
) => useChannelSnapshot('car-condition.snapshot', undefined, bridge, enabled);
