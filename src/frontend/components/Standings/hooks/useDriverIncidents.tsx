import { useSessionBarSnapshot } from '@irdashies/context';

export const useDriverIncidents = () => {
  const snapshot = useSessionBarSnapshot();
  return {
    incidents: snapshot?.incidents ?? 0,
    incidentLimit: snapshot?.incidentLimit,
    incidentWarningInitialLimit: snapshot?.incidentWarningInitialLimit,
    incidentWarningSubsequentLimit: snapshot?.incidentWarningSubsequentLimit,
  };
};
