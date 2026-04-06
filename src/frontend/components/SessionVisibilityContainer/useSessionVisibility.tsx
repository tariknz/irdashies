import { useCurrentSessionType } from '@irdashies/context';
import { SessionVisibilityConfig } from '@irdashies/types';

type SessionType =
  | 'Race'
  | 'Lone Qualify'
  | 'Open Qualify'
  | 'Practice'
  | 'Offline Testing';

const SESSION_TYPE_MAP: Record<
  SessionType,
  keyof SessionVisibilityConfig['sessionVisibility']
> = {
  Race: 'race',
  'Lone Qualify': 'loneQualify',
  'Open Qualify': 'openQualify',
  Practice: 'practice',
  'Offline Testing': 'offlineTesting',
};

/**
 * Hook to check if the current session should be visible based on session visibility settings.
 * @param config - The session visibility settings from widget config
 * @returns true if the current session should be visible, false otherwise
 */
export function useSessionVisibility(
  config: SessionVisibilityConfig | undefined
): boolean {
  const sessionType = useCurrentSessionType();
  if (!sessionType || !config) {
    return true;
  }

  const visibilityKey = SESSION_TYPE_MAP[sessionType];
  if (!visibilityKey) {
    return true;
  }

  return config.sessionVisibility[visibilityKey] ?? true;
}
