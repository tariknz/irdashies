import { useChannelSnapshot } from './useChannelSnapshot';

export const useSessionTimingSnapshot = (enabled = true) =>
  useChannelSnapshot('session-timing.snapshot', undefined, undefined, enabled);
