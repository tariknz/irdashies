import type { ChannelBridge } from '@irdashies/types';
import { useChannelSnapshot } from './useChannelSnapshot';

export const useLapHistorySnapshot = (enabled = true, bridge?: ChannelBridge) =>
  useChannelSnapshot('lap-history.snapshot', undefined, bridge, enabled);
