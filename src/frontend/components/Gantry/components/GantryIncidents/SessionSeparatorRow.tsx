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
        className="sticky top-0 z-10 flex h-[30px] items-center gap-2 border-b border-slate-700 bg-slate-900 px-4 text-xs"
      >
        <span className="truncate font-semibold tracking-wider text-slate-300 uppercase">
          {label}
        </span>
        {isCurrent && (
          <span className="flex-shrink-0 rounded-sm border border-settings-boundary px-1.5 text-slate-300">
            {isReplay ? 'REPLAY' : 'LIVE'}
          </span>
        )}
        {isEmptyCurrent && (
          <span className="truncate text-slate-400">— no incidents yet</span>
        )}
        <span className="h-px min-w-4 flex-1 bg-settings-hover" />
        {!isEmptyCurrent && (
          <span className="flex-shrink-0 text-slate-400 tabular-nums">
            {count} {count === 1 ? 'incident' : 'incidents'}
          </span>
        )}
      </div>
    );
  }
);
SessionSeparatorRow.displayName = 'SessionSeparatorRow';
