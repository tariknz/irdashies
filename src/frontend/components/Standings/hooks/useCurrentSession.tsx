import { useSingleSession, useTelemetryValue } from '@irdashies/context';

export const useCurrentSession = () => {
  const sessionNum = useTelemetryValue('SessionNum');
  const currentSession = useSingleSession(sessionNum);

  return currentSession;
};
