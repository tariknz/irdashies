import type { SessionBarSnapshot } from '@irdashies/types';
import {
  useChannelSelector,
  useChannelSnapshot,
  type ChannelSelectorOptions,
} from './useChannelSnapshot';

export const sessionBarSelectors = {
  airTemp: (snapshot: SessionBarSnapshot) => snapshot.airTemp,
  displayUnits: (snapshot: SessionBarSnapshot) => snapshot.displayUnits,
  sessionNum: (snapshot: SessionBarSnapshot) => snapshot.sessionNum,
  trackTemp: (snapshot: SessionBarSnapshot) => snapshot.trackTemp,
} as const;

export const useSessionBarSelector = <Selected>(
  selector: (snapshot: SessionBarSnapshot) => Selected,
  options: ChannelSelectorOptions<Selected> = {}
) => useChannelSelector('session-bar.snapshot', selector, options);

export const useSessionBarSnapshot = () =>
  useChannelSnapshot('session-bar.snapshot');
