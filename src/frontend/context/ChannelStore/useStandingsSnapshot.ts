import { useChannelSnapshot } from './useChannelSnapshot';

export const useStandingsSnapshot = (enabled = true) =>
  useChannelSnapshot('standings.snapshot', undefined, undefined, enabled);
