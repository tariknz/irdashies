import { useChannelSnapshot } from './useChannelSnapshot';

export const useRadioSnapshot = (enabled = true) =>
  useChannelSnapshot('radio.snapshot', undefined, undefined, enabled);
