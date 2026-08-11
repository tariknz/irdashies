import type { ChannelBridge } from '@irdashies/types';
import { useChannelSnapshot } from './useChannelSnapshot';

export const useDriverControlsSnapshot = (
  enabled = true,
  bridge?: ChannelBridge
) => useChannelSnapshot('driver-controls.snapshot', undefined, bridge, enabled);
