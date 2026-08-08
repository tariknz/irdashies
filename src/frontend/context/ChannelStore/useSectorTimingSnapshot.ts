import type { SectorTimingSnapshot } from '@irdashies/types';
import { useChannelSnapshot } from './useChannelSnapshot';

export const useSectorTimingSnapshot = (
  enabled = true
): SectorTimingSnapshot | undefined =>
  useChannelSnapshot('sector-timing.snapshot', undefined, undefined, enabled);
