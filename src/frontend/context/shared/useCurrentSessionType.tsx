import { useSessionType } from '@irdashies/context';
import { trackStateSelectors, useTrackStateSelector } from '../ChannelStore';

type SessionType =
  'Race' | 'Lone Qualify' | 'Open Qualify' | 'Practice' | 'Offline Testing';

/**
 * @returns The current session type. Undefined if sessionNum is unknown.
 */
export const useCurrentSessionType = (): SessionType | undefined => {
  const sessionNum =
    useTrackStateSelector(trackStateSelectors.sessionNum) ?? undefined;
  const sessionType = useSessionType(sessionNum);

  return sessionType as SessionType | undefined;
};
