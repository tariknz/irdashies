import { memo, type ReactNode } from 'react';
import {
  InfoIcon,
  UserIcon,
  WarningIcon,
  WrenchIcon,
} from '@phosphor-icons/react';
import type { RacePlanDriftLevel, RacePlanStopRow } from '@irdashies/domain';

export const TimelineFrame = ({
  opacity,
  children,
}: {
  opacity: number;
  children: ReactNode;
}) => (
  <div
    className="@container flex h-full w-full min-h-0 flex-col gap-1.5 overflow-hidden rounded-sm bg-slate-800/(--bg-opacity) p-2 text-sm text-white"
    style={{ ['--bg-opacity' as string]: `${opacity}%` }}
  >
    {children}
  </div>
);

export const TimelineNotice = memo(
  ({ title, hint }: { title: string; hint: string | null }) => (
    <div className="flex flex-1 flex-col items-center justify-center gap-1 p-2 text-center text-slate-300">
      <InfoIcon size={18} className="text-slate-400" />
      <p>{title}</p>
      {hint && <p className="text-xs text-slate-400">{hint}</p>}
    </div>
  )
);
TimelineNotice.displayName = 'TimelineNotice';

export const TimelineBanner = memo(({ text }: { text: string }) => (
  <div className="flex flex-none items-center gap-1 rounded-sm bg-amber-500/20 px-1.5 py-0.5 text-xs text-amber-200">
    <WarningIcon size={14} weight="fill" className="flex-none" />
    <span className="truncate">{text}</span>
  </div>
));
TimelineBanner.displayName = 'TimelineBanner';

const DRIFT_CLASS: Record<RacePlanDriftLevel, string> = {
  behind: 'text-amber-300',
  ahead: 'text-green-400',
  'on-plan': 'text-slate-300',
};

interface TimelineHeaderProps {
  title: string | null;
  driftText: string | null;
  driftLevel: RacePlanDriftLevel;
}

export const TimelineHeader = memo(
  ({ title, driftText, driftLevel }: TimelineHeaderProps) => {
    if (!title && !driftText) return null;
    return (
      <div className="flex flex-none flex-wrap items-center gap-x-3 gap-y-0.5">
        {title && (
          <span className="flex min-w-0 items-center gap-1 font-semibold">
            <UserIcon size={14} className="flex-none text-amber-300" />
            <span className="truncate">{title}</span>
          </span>
        )}
        {driftText && (
          <span
            className={`ml-auto whitespace-nowrap text-xs tabular-nums ${DRIFT_CLASS[driftLevel]}`}
          >
            {driftText}
          </span>
        )}
      </div>
    );
  }
);
TimelineHeader.displayName = 'TimelineHeader';

export const StopsList = memo(({ stops }: { stops: RacePlanStopRow[] }) => {
  if (stops.length === 0) return null;
  return (
    <div className="flex flex-none flex-col gap-0.5 border-t border-slate-700/60 pt-1 text-xs">
      <span className="font-bold uppercase tracking-wider text-slate-400">
        Unplanned stops
      </span>
      {stops.map((stop) => (
        <div key={stop.key} className="flex items-center gap-1 text-slate-200">
          <WrenchIcon size={12} className="flex-none text-amber-300" />
          <span className="min-w-0 flex-1 truncate">{stop.text}</span>
          <span className="flex-none tabular-nums text-slate-400">
            {stop.duration}
          </span>
        </div>
      ))}
    </div>
  );
});
StopsList.displayName = 'StopsList';
