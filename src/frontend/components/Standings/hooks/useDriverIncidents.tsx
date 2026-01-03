import { useSessionStore, useTelemetryValue } from '@irdashies/context';

export const useDriverIncidents = () => {
  const incidentLimit = useSessionStore(
    (state) => state.session?.WeekendInfo?.WeekendOptions?.IncidentLimit
  );
  const incidents = useTelemetryValue('PlayerCarTeamIncidentCount') || 0;
  return {
    incidents,
    incidentLimit: incidentLimit === 'unlimited' ? '' : incidentLimit,
  };
};
