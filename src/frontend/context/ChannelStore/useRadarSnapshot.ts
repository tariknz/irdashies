import type { RadarSnapshot } from '@irdashies/types';
import {
  useChannelSelector,
  type ChannelSelectorOptions,
} from './useChannelSnapshot';

export const useRadarSelector = <Selected>(
  selector: (snapshot: RadarSnapshot) => Selected,
  options: ChannelSelectorOptions<Selected> = {}
) => useChannelSelector('radar.snapshot', selector, options);
