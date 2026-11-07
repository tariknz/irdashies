import {
  useCurrentSessionType,
  type SessionType,
} from './useCurrentSessionType';
import type { SessionVisibilitySettings } from '@irdashies/types';
import { trackStateSelectors, useTrackStateSelector } from '../ChannelStore';

const SESSION_TYPE_MAP: Partial<
  Record<SessionType, keyof SessionVisibilitySettings>
> = {
  Race: 'race',
  'Lone Qualify': 'loneQualify',
  'Open Qualify': 'openQualify',
  Practice: 'practice',
  'Offline Testing': 'offlineTesting',
  Warmup: 'warmup',
};

/**
 * Hook to check if the current session should be visible based on session visibility settings.
 *
 * Out of any session -- LMU reports that through GetGameState -- reads as
 * Offline Testing, whatever session the snapshot last described, so only the
 * widgets allowed there stay up between sessions.
 *
 * @param sessionVisibility - The session visibility settings from widget config
 * @returns true if the current session should be visible, false otherwise
 */
export function useSessionVisibility(
  sessionVisibility: SessionVisibilitySettings | undefined
): boolean {
  const sessionType = useCurrentSessionType();
  const notInSession =
    useTrackStateSelector(trackStateSelectors.notInSession) ?? false;
  if (!sessionVisibility) {
    return true;
  }
  if (notInSession) {
    return sessionVisibility.offlineTesting ?? true;
  }
  if (!sessionType) {
    return true;
  }

  const visibilityKey = SESSION_TYPE_MAP[sessionType];
  if (!visibilityKey) {
    return true;
  }

  return sessionVisibility[visibilityKey] ?? true;
}
