import { useSessionName, useSessionLaps, useTelemetryValue } from '@irdashies/context';
import { formatTime } from '@irdashies/utils/time';
import { useDriverIncidents, useSessionLapCount, useBrakeBias, useRelativeSettings } from '../../hooks';

export const SessionBar = () => {
  const sessionNum = useTelemetryValue('SessionNum');
  const sessionName = useSessionName(sessionNum);
  const sessionLaps = useSessionLaps(sessionNum);
  const { incidentLimit, incidents } = useDriverIncidents();
  const { total, current, timeElapsed, timeRemaining } = useSessionLapCount();
  const brakeBias = useBrakeBias();
  const config = useRelativeSettings();

  const showBrakeBias = config?.brakeBias?.enabled && brakeBias !== undefined;

  return (
    <div className="bg-slate-900/70 text-sm px-3 py-1 flex justify-between">
      <div className="flex">{sessionName}</div>
      {current > 0 && (
        <div className="flex justify-center">
          L {current} {total ? ` / ${total}` : ''}
        </div>
      )}
      {sessionLaps == 'unlimited' && ( // 86400 seconds = 24 hours
        <div className="flex justify-center">
          {(() => {
            const elapsed = formatTime(timeElapsed, 'duration');
            const remaining = formatTime(timeRemaining, 'duration-wlabels');
            return elapsed ? `${elapsed} / ${remaining}` : (remaining ? `${remaining}` : '');
          })()}
        </div>
      )}
      {showBrakeBias && (
        <div className="flex justify-center">
          {brakeBias.isClio ? `BV: ${brakeBias.value.toFixed(0)}` : `BB: ${brakeBias.value.toFixed(1)}%`}
        </div>
      )}
      <div className="flex justify-end">
        {incidents}
        {incidentLimit ? ' / ' + incidentLimit : ''} x
      </div>
    </div>
  );
};
