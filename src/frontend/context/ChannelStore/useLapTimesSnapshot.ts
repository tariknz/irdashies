import type { ChannelBridge } from '@irdashies/types';
import { useChannelSnapshot } from './useChannelSnapshot';

export const useLapTimesSnapshot = (enabled = true, bridge?: ChannelBridge) =>
  useChannelSnapshot('lap-times.snapshot', undefined, bridge, enabled);
