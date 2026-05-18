import { useSessionStore, useTelemetryValue } from '@irdashies/context';

export const useDriverIncidents = () => {
  const incidentLimit = useSessionStore(
    (state) => state.session?.WeekendInfo?.WeekendOptions?.IncidentLimit
  );
  const incidentWarningInitialLimit = useSessionStore(
    (state) =>
      state.session?.WeekendInfo?.WeekendOptions?.IncidentWarningInitialLimit
  );
  const incidentWarningSubsequentLimit = useSessionStore(
    (state) =>
      state.session?.WeekendInfo?.WeekendOptions?.IncidentWarningSubsequentLimit
  );
  const incidents = useTelemetryValue('PlayerCarTeamIncidentCount') || 0;
  return {
    incidents,
    incidentLimit,
    incidentWarningInitialLimit,
    incidentWarningSubsequentLimit,
  };
};
