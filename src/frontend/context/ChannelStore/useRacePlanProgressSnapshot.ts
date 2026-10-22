import type { ChannelBridge } from '@irdashies/types';
import { useChannelSnapshot } from './useChannelSnapshot';

export const useRacePlanProgressSnapshot = (bridge?: ChannelBridge) =>
  useChannelSnapshot('race-plan.progress', undefined, bridge);
