import { memo } from 'react';
import type { RacePlanClashLevel, RacePlanStrip } from '@irdashies/domain';
import type { RacePlanStintStatus } from '@irdashies/types';

const SEGMENT_CLASS: Record<RacePlanStintStatus, string> = {
  done: 'bg-slate-500',
  current: 'bg-sky-500',
  upcoming: 'bg-slate-600',
  unassigned: 'bg-amber-500/50',
  dropped: 'bg-transparent',
};

interface StripSegmentProps {
  number: number;
  status: RacePlanStintStatus;
  mine: boolean;
  leftPct: number;
  widthPct: number;
  clashLevel: RacePlanClashLevel | null;
}

const StripSegment = memo(
  ({
    number,
    status,
    mine,
    leftPct,
    widthPct,
    clashLevel,
  }: StripSegmentProps) => (
    <div
      title={`Stint ${number}`}
      className={[
        'absolute inset-y-0 border-r border-slate-900',
        SEGMENT_CLASS[status],
        mine ? 'ring-2 ring-inset ring-amber-300' : '',
      ].join(' ')}
      style={{ left: `${leftPct}%`, width: `${widthPct}%` }}
    >
      {clashLevel && (
        <div
          className={`absolute inset-x-0 top-0 h-1 ${clashLevel === 'clash' ? 'bg-red-500' : 'bg-amber-300'}`}
        />
      )}
    </div>
  )
);
StripSegment.displayName = 'StripSegment';

interface TimelineStripProps {
  strip: RacePlanStrip;
  startLabel: string;
  endLabel: string;
}

/** The whole race as a bar, one segment per stint, with a "now" marker. */
export const TimelineStrip = memo(
  ({ strip, startLabel, endLabel }: TimelineStripProps) => (
    <div className="flex flex-none flex-col gap-0.5">
      <div
        className="relative h-4 overflow-hidden rounded-sm bg-slate-900/60"
        role="img"
        aria-label="Race strip"
      >
        {strip.segments.map((segment) => (
          <StripSegment key={segment.number} {...segment} />
        ))}
        {strip.nowPct !== null && (
          <div
            className="absolute inset-y-0 w-0.5 bg-white shadow-[0_0_2px_rgba(0,0,0,0.8)]"
            style={{ left: `${strip.nowPct}%` }}
            title="Now"
          />
        )}
      </div>
      <div className="flex justify-between text-[10px] tabular-nums text-slate-400">
        <span>{startLabel}</span>
        <span>{endLabel}</span>
      </div>
    </div>
  )
);
TimelineStrip.displayName = 'TimelineStrip';
