import { useSessionName, useTelemetryValue } from '@irdashies/context';
import { formatTimeElapsedHMS, formatTimeRemaining } from '@irdashies/utils/time';
import { useDriverIncidents, useSessionLapCount, useBrakeBias, useRelativeSettings } from '../../hooks';

export const SessionBar = () => {
  const sessionNum = useTelemetryValue('SessionNum');
  const sessionName = useSessionName(sessionNum);
  const { incidentLimit, incidents } = useDriverIncidents();
  const { total, current, timeElapsed, timeRemaining } = useSessionLapCount();
  const brakeBias = useBrakeBias();
  const config = useRelativeSettings();

  const showBrakeBias = config?.brakeBias?.enabled && brakeBias !== undefined;

  return (
    <div className="bg-slate-900/70 text-sm px-3 py-1 flex justify-between">
      <div className="flex flex-1 grow">{sessionName}</div>
      {current > 0 && (
        <div className="flex flex-1 grow justify-center">
          L {current} {total ? ` / ${total}` : ''}
        </div>
      )}
      {timeRemaining <= 86400 && ( // 86400 seconds = 24 hours
        <div className="flex flex-1 grow justify-center">
          {(() => {
            const elapsed = formatTimeElapsedHMS(timeElapsed);
            const remaining = formatTimeRemaining(timeRemaining);
            return elapsed ? `${elapsed} / ${remaining}` : (remaining ? `${remaining}` : '');
          })()}
        </div>
      )}
      {showBrakeBias && (
        <div className="flex flex-1 grow justify-center">
          {brakeBias.isClio ? `BV: ${brakeBias.value.toFixed(0)}` : `BB: ${brakeBias.value.toFixed(1)}%`}
        </div>
      )}
      <div className="flex flex-1 grow justify-end">
        {incidents}
        {incidentLimit ? ' / ' + incidentLimit : ''} x
      </div>
    </div>
  );
};
