import { memo } from 'react';
import { formatDelta } from '@irdashies/utils/time';

/** |delta| that fills the whole track. Past this the fill stays full. */
export const LIVE_DELTA_BAR_RANGE_S = 1;

const HATCH =
  'repeating-linear-gradient(-45deg, transparent, transparent 3px, rgb(255 255 255 / 0.2) 3px, rgb(255 255 255 / 0.2) 6px)';

export const LiveDeltaBar = memo(
  ({
    delta,
    active,
    dirty,
  }: {
    delta?: number;
    active: boolean;
    dirty?: boolean;
  }) => {
    const value = active && delta !== undefined ? delta : 0;
    const isFaster = active && !dirty && value < 0;
    const isSlower = active && !dirty && value > 0;
    const fillPct = active
      ? Math.min(Math.abs(value) / LIVE_DELTA_BAR_RANGE_S, 1) * 100
      : 0;
    const fillColor = isFaster
      ? 'rgb(34 197 94)'
      : isSlower
        ? 'rgb(239 68 68)'
        : undefined;

    return (
      <div
        id="live-delta-bar"
        className="relative text-[1.3em] min-h-[1.6em] w-full overflow-hidden rounded-sm bg-slate-900"
      >
        {fillColor && fillPct > 0 && (
          <div
            className="absolute inset-y-0 transition-[width,left] duration-100 ease-out"
            style={{
              width: `${fillPct}%`,
              // Green grows from the left edge; red from the right.
              left: isFaster ? '0%' : `${100 - fillPct}%`,
              backgroundColor: fillColor,
              backgroundImage: HATCH,
            }}
          />
        )}
        <div
          className={`relative z-10 flex h-full min-h-[1.6em] w-full items-center justify-center px-2 tabular-nums font-semibold ${
            fillColor && fillPct > 0 ? 'text-white' : 'text-zinc-400'
          }`}
        >
          {formatDelta(active ? value : 0)}
        </div>
      </div>
    );
  }
);
LiveDeltaBar.displayName = 'LiveDeltaBar';
