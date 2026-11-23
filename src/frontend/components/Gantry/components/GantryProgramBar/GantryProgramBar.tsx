import { memo } from 'react';
import { ArrowFatLineLeft, Television } from '@phosphor-icons/react';
import { formatTimecode } from '@irdashies/types';
import { useReplayTimecodeSnapshot } from '@irdashies/context';

interface GantryProgramBarProps {
  onBackToProgram: () => void;
  onStayHere: () => void;
  onResumeAtCut: () => void;
  sessionTime: number;
  cutawaySessionTime: number | null;
  liveSessionTime: number;
  isCutAway: boolean;
}

export const GantryProgramBar = memo(
  ({
    onBackToProgram,
    onStayHere,
    onResumeAtCut,
    sessionTime,
    cutawaySessionTime,
    liveSessionTime,
    isCutAway,
  }: GantryProgramBarProps) => {
    return (
      <div
        role="status"
        className="settings-shell flex items-center gap-2 px-3 py-1.5 bg-amber-900/40 border-b border-amber-700/50 text-sm text-amber-200 shrink-0 overflow-x-auto"
      >
        <Television size={16} className="text-amber-400 shrink-0" />
        <span className="whitespace-nowrap tabular-nums">
          Current: {formatTimecode(sessionTime)}
        </span>
        {isCutAway && (
          <button
            type="button"
            onClick={onStayHere}
            className="inline-flex items-center px-2.5 h-6 rounded border border-amber-600/60 bg-amber-950/60 text-xs font-medium text-amber-100 transition-colors hover:bg-amber-800/70 shrink-0"
          >
            Make current live
          </button>
        )}
        <span className="whitespace-nowrap tabular-nums">
          Cutaway:{' '}
          {cutawaySessionTime === null
            ? ''
            : formatTimecode(cutawaySessionTime)}
        </span>
        {isCutAway && (
          <button
            type="button"
            onClick={onResumeAtCut}
            className="inline-flex items-center gap-1 px-2.5 h-6 rounded border border-amber-600/60 bg-amber-950/60 text-xs font-medium text-amber-100 transition-colors hover:bg-amber-800/70 shrink-0"
          >
            <ArrowFatLineLeft size={12} weight="fill" />
            Return to cutaway
          </button>
        )}
        <span className="whitespace-nowrap tabular-nums">
          Live: {formatTimecode(liveSessionTime)}
        </span>
        {isCutAway && (
          <button
            type="button"
            onClick={onBackToProgram}
            className="inline-flex items-center gap-1 px-2.5 h-6 rounded text-xs font-medium text-amber-900 bg-amber-400 transition-colors hover:bg-amber-300 shrink-0"
          >
            Return to live
          </button>
        )}
      </div>
    );
  }
);
GantryProgramBar.displayName = 'GantryProgramBar';

export const GantryProgramBarContainer = () => {
  const snap = useReplayTimecodeSnapshot();

  if (!snap.active) return null;

  const handleBackToProgram = () => {
    void window.replayDirectorBridge?.backToProgram();
  };
  const handleStayHere = () => {
    void window.replayDirectorBridge?.stayHere();
  };
  const handleResumeAtCut = () => {
    void window.replayDirectorBridge?.resumeAtCut();
  };

  return (
    <GantryProgramBar
      onBackToProgram={handleBackToProgram}
      onStayHere={handleStayHere}
      onResumeAtCut={handleResumeAtCut}
      sessionTime={snap.sessionTime}
      cutawaySessionTime={snap.program.cutawaySessionTime}
      liveSessionTime={snap.program.sessionTime}
      isCutAway={snap.program.state === 'cutAway'}
    />
  );
};
