import { memo } from 'react';
import { useDriverIncidents } from '../../hooks';

export const IncidentCountItem = memo(() => {
  const { incidentLimit, incidents } = useDriverIncidents();
  return (
    <div className="flex justify-end">
      {incidents}
      {incidentLimit ? ' / ' + incidentLimit : ''} x
    </div>
  );
});
IncidentCountItem.displayName = 'IncidentCountItem';
