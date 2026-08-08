import { useCarSpeedsSnapshot } from '../ChannelStore';

/**
 * Reads the main-process car-speed snapshot when the consuming feature is enabled.
 * @returns An array of speeds for each car in the session by index. Speed value in km/h
 */
export function useCarIdxSpeed(enabled = true) {
  return useCarSpeedsSnapshot(enabled)?.carSpeeds ?? [];
}
