import type { StandingsSnapshot } from '@irdashies/types';
import {
  useChannelSelector,
  useChannelSnapshot,
  type ChannelSelectorOptions,
} from './useChannelSnapshot';

export const standingsSelectors = {
  carIdxLap: (snapshot: StandingsSnapshot) => snapshot.carIdxLap,
} as const;

export const useStandingsSelector = <Selected>(
  selector: (snapshot: StandingsSnapshot) => Selected,
  options: ChannelSelectorOptions<Selected> = {}
) => useChannelSelector('standings.snapshot', selector, options);

export const useStandingsSnapshot = (enabled = true) =>
  useChannelSnapshot('standings.snapshot', undefined, undefined, enabled);
