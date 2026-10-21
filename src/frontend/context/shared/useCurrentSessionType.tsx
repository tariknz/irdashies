import { useSessionType } from '@irdashies/context';
import { trackStateSelectors, useTrackStateSelector } from '../ChannelStore';

export type SessionType =
  | 'Race'
  | 'Lone Qualify'
  | 'Open Qualify'
  | 'Practice'
  | 'Offline Testing'
  | 'Warmup'
  // A Time Trial reports as this.
  | 'Lone Practice';

/**
 * @returns The current session type. Undefined if sessionNum is unknown.
 */
export const useCurrentSessionType = (): SessionType | undefined => {
  const sessionNum =
    useTrackStateSelector(trackStateSelectors.sessionNum) ?? undefined;
  const sessionType = useSessionType(sessionNum);

  return sessionType as SessionType | undefined;
};
