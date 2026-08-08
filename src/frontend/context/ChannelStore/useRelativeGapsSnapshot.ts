import type { RelativeGapsSnapshot } from '@irdashies/types';
import { useChannelSnapshot } from './useChannelSnapshot';

export const useRelativeGapsSnapshot = (): RelativeGapsSnapshot | undefined =>
  useChannelSnapshot('relative-gaps.snapshot');
