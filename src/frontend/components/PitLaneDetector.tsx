import { usePitLaneDetection } from '@irdashies/context';

/**
 * Component that monitors telemetry to detect pit entry/exit positions.
 * Should be mounted once at the app level.
 */
export const PitLaneDetector = () => {
  usePitLaneDetection();
  return null; // No UI, just runs the detection logic
};
