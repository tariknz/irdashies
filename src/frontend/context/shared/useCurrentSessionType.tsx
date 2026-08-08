import { useSessionType } from '@irdashies/context';
import { useTrackStateSnapshot } from '../ChannelStore';

type SessionType = 'Race' | 'Lone Qualify' | 'Open Qualify' | 'Practice' | 'Offline Testing';

/**
 * @returns The current session type. Undefined if sessionNum is unknown.
 */
export const useCurrentSessionType = (): SessionType | undefined => {
  const sessionNum = useTrackStateSnapshot()?.sessionNum ?? undefined;
  const sessionType = useSessionType(sessionNum);

  return sessionType as SessionType | undefined;
};
