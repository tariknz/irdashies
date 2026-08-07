import type { ChannelBridge } from '@irdashies/types';
import { useChannelSnapshot } from './useChannelSnapshot';

export const useLapTimesSnapshot = (bridge?: ChannelBridge) =>
  useChannelSnapshot('lap-times.snapshot', undefined, bridge);
