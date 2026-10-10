import {
  useCurrentSessionType,
  type SessionType,
} from './useCurrentSessionType';
import type { SessionVisibilitySettings } from '@irdashies/types';

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
 * @param sessionVisibility - The session visibility settings from widget config
 * @returns true if the current session should be visible, false otherwise
 */
export function useSessionVisibility(
  sessionVisibility: SessionVisibilitySettings | undefined
): boolean {
  const sessionType = useCurrentSessionType();
  if (!sessionType || !sessionVisibility) {
    return true;
  }

  const visibilityKey = SESSION_TYPE_MAP[sessionType];
  if (!visibilityKey) {
    return true;
  }

  return sessionVisibility[visibilityKey] ?? true;
}
