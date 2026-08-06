import type { ChannelBridge } from '@irdashies/types';
import { useChannelSnapshot } from './useChannelSnapshot';

export const useFuelProjectionSnapshot = (bridge?: ChannelBridge) =>
  useChannelSnapshot('fuel.projection', undefined, bridge);
