import { memo } from 'react';

interface SessionSeparatorRowProps {
  label: string;
  count: number;
  isCurrent: boolean;
  isReplay: boolean;
}

export const SessionSeparatorRow = memo(
  ({ label, count, isCurrent, isReplay }: SessionSeparatorRowProps) => {
    const isEmptyCurrent = isCurrent && count === 0;
    return (
      <div
        role="heading"
        aria-level={3}
        className="sticky top-0 z-10 flex items-center gap-2 px-3 py-1 bg-slate-900 border-y border-slate-700 text-xs"
      >
        <span className="font-extrabold uppercase tracking-wider text-slate-200 truncate">
          {label}
        </span>
        {isCurrent && (
          <span className="px-1.5 rounded border border-amber-500/50 bg-amber-500/20 text-amber-300 text-[10px] font-extrabold tracking-wider flex-shrink-0">
            {isReplay ? 'REPLAY' : 'LIVE'}
          </span>
        )}
        {isEmptyCurrent && (
          <span className="text-slate-500 truncate">— no incidents yet</span>
        )}
        <span className="flex-1 h-px bg-slate-700 min-w-4" />
        {!isEmptyCurrent && (
          <span className="text-slate-400 flex-shrink-0">
            {count} {count === 1 ? 'incident' : 'incidents'}
          </span>
        )}
      </div>
    );
  }
);
SessionSeparatorRow.displayName = 'SessionSeparatorRow';
