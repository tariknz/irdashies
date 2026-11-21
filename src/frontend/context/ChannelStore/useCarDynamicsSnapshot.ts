import type { ChannelBridge } from '@irdashies/types';
import { useChannelSnapshot } from './useChannelSnapshot';

export const useCarDynamicsSnapshot = (
  enabled = true,
  bridge?: ChannelBridge
) => useChannelSnapshot('car-dynamics.snapshot', undefined, bridge, enabled);
