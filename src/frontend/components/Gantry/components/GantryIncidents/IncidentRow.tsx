import { memo, useState } from 'react';
import { Copy } from '@phosphor-icons/react';
import type { Incident } from '@irdashies/types';
import { IncidentType } from '@irdashies/types';
import { Tooltip } from '../Tooltip/Tooltip';
import logger from '@irdashies/utils/logger';

const TYPE_STYLES: Record<IncidentType, { label: string; classes: string }> = {
  [IncidentType.PitEntry]: {
    label: 'Pit Entry',
    classes: 'bg-blue-500/20 text-blue-400',
  },
  [IncidentType.OffTrack]: {
    label: 'Off Track',
    classes: 'bg-yellow-500/20 text-yellow-400',
  },
  [IncidentType.Slowdown]: {
    label: 'Slowdown',
    classes: 'bg-orange-500/20 text-orange-400',
  },
  [IncidentType.Crash]: {
    label: 'Crash',
    classes: 'bg-red-500/20 text-red-400',
  },
  [IncidentType.BlackFlag]: {
    label: 'Black Flag',
    classes: 'bg-white/10 text-slate-300',
  },
};

const formatSessionTime = (seconds: number): string => {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
};

interface Props {
  incident: Incident;
  isReplayPlaying: boolean;
}

export const IncidentRow = memo(({ incident, isReplayPlaying }: Props) => {
  const canReplay = isReplayPlaying;
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'failed'>(
    'idle'
  );
  const style = TYPE_STYLES[incident.type];

  const handleReplay = (seconds: number) => {
    window.raceControlBridge?.replayIncident(incident, seconds);
  };

  const handleCopyLog = async () => {
    if (!incident.debug) return;
    try {
      // Clipboard access is denied outside a secure context and can be
      // refused by the user, so a silent failure would leave the button
      // looking like it had worked.
      await navigator.clipboard.writeText(
        JSON.stringify(incident.debug, null, 2)
      );
      setCopyState('copied');
    } catch (err) {
      logger.warn('[Gantry] Could not copy the incident log', err);
      setCopyState('failed');
    }
    setTimeout(() => setCopyState('idle'), 1500);
  };

  return (
    <div className="border-b border-settings-hover/55 px-4 py-2">
      <div className="mb-1.5 flex items-center gap-2">
        <span
          className={`flex-shrink-0 rounded-sm px-2 py-px text-xs font-semibold ${style.classes}`}
        >
          {style.label}
        </span>
        <span className="text-md font-semibold text-white tabular-nums">
          #{incident.carNumber}
        </span>
        <span className="text-md min-w-0 flex-1 truncate text-slate-300">
          {incident.driverName}
        </span>
        <span className="flex-shrink-0 text-sm text-slate-400 tabular-nums">
          L{incident.lapNum}
        </span>
        <span className="flex-shrink-0 text-sm text-slate-400 tabular-nums">
          {formatSessionTime(incident.sessionTime)}
        </span>
      </div>
      <div className="flex items-center justify-end gap-1.5">
        {!canReplay && (
          <span className="flex-1 text-sm text-slate-400">
            Live -- replay unavailable
          </span>
        )}
        {([5, 10, 30] as const).map((seconds) => (
          // Disabled buttons emit no mouse events, so the span carries them.
          <Tooltip
            key={seconds}
            content={
              canReplay
                ? `Jumps the sim's replay to ${seconds} seconds before this incident and points the camera at #${incident.carNumber}.`
                : 'Only works while a replay is playing. The sim is running live, so there is no replay position to jump to.'
            }
          >
            <span className="inline-flex">
              <button
                onClick={() => handleReplay(seconds)}
                disabled={!canReplay}
                className="settings-button min-h-7 px-2.5 py-0.5 tabular-nums"
              >
                -{seconds}s
              </button>
            </span>
          </Tooltip>
        ))}
        {incident.debug && (
          <Tooltip content="Copies this incident's detection snapshot — what triggered it, the evidence, and the thresholds in force — to the clipboard.">
            <button
              onClick={handleCopyLog}
              className="settings-button min-h-7 px-2.5 py-0.5"
            >
              <Copy aria-hidden="true" size={14} />
              {copyState === 'copied'
                ? 'Copied!'
                : copyState === 'failed'
                  ? 'Failed'
                  : 'Log'}
            </button>
          </Tooltip>
        )}
      </div>
    </div>
  );
});
IncidentRow.displayName = 'IncidentRow';
