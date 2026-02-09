import type { PitLaneBridge } from '@irdashies/types';
import { usePitLaneDetection } from './usePitLaneDetection';

export interface PitLaneProviderProps {
  bridge: PitLaneBridge | Promise<PitLaneBridge>;
}

/**
 * Provider that monitors telemetry to detect pit entry/exit positions.
 * Should be mounted once at the app level.
 */
export const PitLaneProvider = ({ bridge }: PitLaneProviderProps) => {
  usePitLaneDetection(bridge);
  return null;
};
