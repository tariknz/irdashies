import { useCurrentSessionType } from './useCurrentSessionType';
import type { SessionVisibilitySettings } from '../../components/Settings/types';

type SessionType = 'Race' | 'Lone Qualify' | 'Open Qualify' | 'Practice' | 'Offline Testing';

const SESSION_TYPE_MAP: Record<SessionType, keyof SessionVisibilitySettings> = {
  'Race': 'race',
  'Lone Qualify': 'loneQualify',
  'Open Qualify': 'openQualify',
  'Practice': 'practice',
  'Offline Testing': 'offlineTesting',
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
