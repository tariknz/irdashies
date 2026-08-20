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
  isOdd: boolean;
  isReplayPlaying: boolean;
}

export const IncidentRow = memo(
  ({ incident, isOdd, isReplayPlaying }: Props) => {
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
      <div
        className={`px-3 py-2 border-b border-white/5 ${isOdd ? 'bg-slate-900/80' : 'bg-slate-800/50'}`}
      >
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`px-1.5 py-0.5 rounded text-xs font-extrabold uppercase tracking-wider flex-shrink-0 ${style.classes}`}
          >
            {style.label}
          </span>
          <span className="text-white font-bold text-sm">
            #{incident.carNumber}
          </span>
          <span className="text-slate-300 text-sm flex-1 truncate">
            {incident.driverName}
          </span>
          <span className="text-slate-500 text-xs flex-shrink-0">
            L{incident.lapNum}
          </span>
          <span className="text-slate-600 text-xs flex-shrink-0">
            {formatSessionTime(incident.sessionTime)}
          </span>
        </div>
        <div className="flex items-center gap-1 justify-end">
          {!canReplay && (
            <span className="text-slate-600 text-xs flex-1">
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
                  className={[
                    'px-2 py-0.5 rounded text-xs font-bold',
                    canReplay
                      ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/40 hover:bg-indigo-500/30'
                      : 'bg-white/5 text-slate-600 border border-slate-700 cursor-not-allowed',
                  ].join(' ')}
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
                className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-slate-700 text-slate-400 hover:text-slate-200 border border-slate-600"
              >
                <Copy size={10} />
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
  }
);
IncidentRow.displayName = 'IncidentRow';
