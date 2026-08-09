import type { BlindSpotSnapshot } from '@irdashies/types';
import {
  useChannelSelector,
  type ChannelSelectorOptions,
} from './useChannelSnapshot';

export const useBlindSpotSelector = <Selected>(
  selector: (snapshot: BlindSpotSnapshot) => Selected,
  options: ChannelSelectorOptions<Selected> = {}
) => useChannelSelector('blind-spot.snapshot', selector, options);
