import { useSessionType, useTelemetryValue } from '@irdashies/context';

type SessionType = 'Race' | 'Lone Qualify' | 'Open Qualify' | 'Practice' | 'Offline Testing';

/**
 * @returns The current session type. Undefined if sessionNum is unknown.
 */
export const useCurrentSessionType = (): SessionType | undefined => {
  const sessionNum = useTelemetryValue('SessionNum');
  const sessionType = useSessionType(sessionNum);

  return sessionType as SessionType | undefined;
};