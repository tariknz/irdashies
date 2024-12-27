import { useMemo } from 'react';
import { useSession, useSingleTelemetryValue } from '@irdashies/context';

export const useCurrentSession = () => {
  const sessionNum = useSingleTelemetryValue('SessionNum');
  const { session } = useSession();
  const currentSession = useMemo(() => {
    if (!session?.SessionInfo?.Sessions) {
      return undefined;
    }

    const sessions = session.SessionInfo.Sessions;

    return sessions.find((s) => s.SessionNum === sessionNum) || undefined;
  }, [session?.SessionInfo?.Sessions, sessionNum]);

  return currentSession;
};
