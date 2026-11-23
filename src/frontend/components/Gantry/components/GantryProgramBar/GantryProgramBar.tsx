import { memo } from 'react';
import { ArrowFatLineLeft, Television } from '@phosphor-icons/react';
import { formatTimecode } from '@irdashies/types';
import { useReplayTimecodeSnapshot } from '@irdashies/context';

interface GantryProgramBarProps {
  onBackToProgram: () => void;
  onStayHere: () => void;
  onResumeAtCut: () => void;
  programSessionTime: number;
  offsetSeconds: number;
  wasLive: boolean;
}

export const GantryProgramBar = memo(
  ({
    onBackToProgram,
    onStayHere,
    onResumeAtCut,
    programSessionTime,
    offsetSeconds,
    wasLive,
  }: GantryProgramBarProps) => {
    const isAhead = offsetSeconds < 0;
    const behindSeconds = Math.abs(Math.round(offsetSeconds));
    const label = wasLive
      ? 'Program is live'
      : `Program: ${formatTimecode(programSessionTime)}`;
    const offsetLabel = isAhead
      ? `${behindSeconds}s ahead`
      : `${behindSeconds}s behind`;

    return (
      <div
        role="status"
        className="settings-shell flex items-center gap-2 px-3 py-1.5 bg-amber-900/40 border-b border-amber-700/50 text-sm text-amber-200 shrink-0"
      >
        <Television size={16} className="text-amber-400 shrink-0" />
        <span className="flex-1 min-w-0 truncate">
          {label}
          {behindSeconds > 0 && (
            <span className="text-amber-400 ml-1.5">({offsetLabel})</span>
          )}
        </span>
        <button
          type="button"
          onClick={onResumeAtCut}
          className="inline-flex items-center gap-1 px-2 h-6 rounded text-xs text-slate-300 transition-colors hover:bg-slate-700 hover:text-white shrink-0"
        >
          Stay here
        </button>
        <button
          type="button"
          onClick={onStayHere}
          className="inline-flex items-center gap-1 px-2 h-6 rounded text-xs text-slate-300 transition-colors hover:bg-slate-700 hover:text-white shrink-0"
        >
          Resume cut
        </button>
        <button
          type="button"
          onClick={onBackToProgram}
          className="inline-flex items-center gap-1 px-2.5 h-6 rounded text-xs font-medium text-amber-900 bg-amber-400 transition-colors hover:bg-amber-300 shrink-0"
        >
          <ArrowFatLineLeft size={12} weight="fill" />
          Back to program
        </button>
      </div>
    );
  }
);
GantryProgramBar.displayName = 'GantryProgramBar';

export const GantryProgramBarContainer = () => {
  const snap = useReplayTimecodeSnapshot();

  if (!snap.active || snap.program.state !== 'cutAway') return null;

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
      programSessionTime={snap.program.sessionTime}
      offsetSeconds={snap.program.offsetSeconds}
      wasLive={snap.program.wasLive}
    />
  );
};
