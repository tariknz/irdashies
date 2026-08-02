import { memo } from 'react';
import { useDriverIncidents } from '../../../../hooks';
import { getIncidentDisplay } from '../../getIncidentDisplay';
import { sessionBarItemWrapperClass } from '../../sessionBarItemWrapperClass';
import type { SessionBarItemProps } from '../../sessionBarItemTypes';

export const IncidentCountItem = memo(({ standalone }: SessionBarItemProps) => {
  const {
    incidentLimit,
    incidents,
    incidentWarningInitialLimit,
    incidentWarningSubsequentLimit,
  } = useDriverIncidents();

  return (
    <div className={sessionBarItemWrapperClass(standalone)}>
      <div className="flex justify-end tabular-nums">
        {getIncidentDisplay(
          incidents,
          incidentWarningInitialLimit,
          incidentWarningSubsequentLimit,
          incidentLimit
        )}
      </div>
    </div>
  );
});
IncidentCountItem.displayName = 'IncidentCountItem';
