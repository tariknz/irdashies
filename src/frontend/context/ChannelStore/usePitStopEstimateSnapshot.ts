import type { ChannelBridge } from '@irdashies/types';
import { useChannelSnapshot } from './useChannelSnapshot';

export const usePitStopEstimateSnapshot = (
  enabled = true,
  bridge?: ChannelBridge
) =>
  useChannelSnapshot('pit-stop-estimate.snapshot', undefined, bridge, enabled);
