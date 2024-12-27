import { useMemo } from 'react';
import { useSession, useTelemetryValue } from '@irdashies/context';

export const useDriverIncidents = () => {
  const incidents = useTelemetryValue('PlayerCarTeamIncidentCount') || 0;
  const { session } = useSession();
  const incidentLimit = useMemo(() => {
    let limit = session?.WeekendInfo?.WeekendOptions?.IncidentLimit || 0;
    if (limit === 'unlimited') limit = '';
    return limit;
  }, [session?.WeekendInfo?.WeekendOptions?.IncidentLimit]);

  return {
    incidents,
    incidentLimit,
  };
};
