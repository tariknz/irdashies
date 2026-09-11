import type { RefObject } from 'react';
import {
  DEFAULT_LAP_TRACE_COLORS,
  type BrakeCueTone,
  type LapTraceColors,
} from '@irdashies/types';

export const BRAKE_CUE_BAR_COUNT = 4;

/** The four user-configurable rungs of the countdown ladder. */
export type BrakeCueColors = Pick<
  LapTraceColors,
  'brakeCueGreen' | 'brakeCueAmber' | 'brakeCueOrange' | 'brakeCueRed'
>;

/**
 * Drained bars keep a faint track, so the eye reads "3 of 4", not "3". Not
 * user-configurable — it is the strip's own background, not a countdown tone.
 */
export const BRAKE_CUE_UNLIT_COLOR = 'rgb(71 85 105 / 0.25)';

/** `colors` defaults so callers that only care about the built-in ladder
 * (stories, tests) can omit it. */
export const brakeCueColor = (
  tone: BrakeCueTone,
  colors: BrakeCueColors = DEFAULT_LAP_TRACE_COLORS
): string => {
  switch (tone) {
    case 'green':
      return colors.brakeCueGreen;
    case 'amber':
      return colors.brakeCueAmber;
    case 'orange':
      return colors.brakeCueOrange;
    case 'red':
      return colors.brakeCueRed;
    case 'off':
    default:
      return BRAKE_CUE_UNLIT_COLOR;
  }
};

/**
 * Whether the bar at `index` (0 is the topmost) is still lit, given how many
 * remain.
 *
 * The strip always drains *towards* whichever end holds the final bar, so that
 * bar is the last one out and the one that turns red at the brake point.
 */
export const isBrakeCueBarLit = (
  index: number,
  bars: number,
  lastBar: 'top' | 'bottom'
): boolean =>
  lastBar === 'top' ? index < bars : index >= BRAKE_CUE_BAR_COUNT - bars;

/** Which edge of the widget the strip sits on. */
export type BrakeCueBarSide = 'left' | 'right' | 'top' | 'bottom';

/** `left`/`right` run a vertical column of discrete bars; `top`/`bottom` run one continuous bar. */
export const isBrakeCueHorizontal = (side: BrakeCueBarSide): boolean =>
  side === 'top' || side === 'bottom';

export interface BrakeCueBarsProps {
  stripRef: RefObject<HTMLDivElement | null>;
  /** Index 0 is the topmost bar. Vertical (`left`/`right`) sides only. */
  barsRef: RefObject<(HTMLDivElement | null)[]>;
  /** The single continuous fill bar. Horizontal (`top`/`bottom`) sides only. */
  fillRef: RefObject<HTMLDivElement | null>;
  /** Distance-to-brake-point readout, e.g. "124m" or "BRAKE". */
  distanceRef: RefObject<HTMLSpanElement | null>;
  side: BrakeCueBarSide;
  /**
   * Which end the final bar sits at — the one that turns red at the brake
   * point — and so which end the distance readout sits at too. Vertical
   * sides only; a horizontal strip always reads right-to-left, so the
   * readout is always on the right.
   */
  lastBar: 'top' | 'bottom';
}

const distanceTextClassName = 'font-bold tabular-nums leading-none';

/**
 * The countdown strip: warms from green through to red as the reference lap's
 * brake point approaches, with a metres-remaining readout (or "BRAKE" at the
 * point itself) next to it.
 *
 * Props-only and hook-free — the driver hook mutates these refs directly from
 * its rAF loop, so this renders identically in a story with no telemetry.
 *
 * A strip beside/above/below the plot rather than an overlay on top of it, so
 * it never covers the trace. It keeps its footprint even while hidden —
 * toggling `visibility`, not `display` — because collapsing it between
 * braking zones would resize the plot and make the whole trace jump every
 * time a braking zone started or ended.
 */
export const BrakeCueBars = ({
  stripRef,
  barsRef,
  fillRef,
  distanceRef,
  side,
  lastBar,
}: BrakeCueBarsProps) => {
  if (isBrakeCueHorizontal(side)) {
    return (
      <div
        ref={stripRef}
        data-testid="brake-cue-bars"
        data-side={side}
        className="pointer-events-none flex h-5 w-full flex-none items-center gap-2 px-1"
        style={{ visibility: 'hidden' }}
      >
        <div className="h-2.5 flex-1 overflow-hidden rounded-[1px] bg-slate-700/40">
          <div
            ref={fillRef}
            className="h-full rounded-[1px]"
            style={{ width: '0%', backgroundColor: BRAKE_CUE_UNLIT_COLOR }}
          />
        </div>
        <span
          ref={distanceRef}
          data-testid="brake-cue-distance"
          className={`w-14 text-right text-xs ${distanceTextClassName}`}
        />
      </div>
    );
  }

  // A fixed 40px column has little room for a readout beside 4 full-height
  // bars, hence the small text — same reason the header's other compact
  // labels (e.g. the reference source name) drop to 9px.
  const distance = (
    <span
      ref={distanceRef}
      data-testid="brake-cue-distance"
      className={`text-[9px] ${distanceTextClassName}`}
    />
  );

  return (
    <div
      ref={stripRef}
      data-testid="brake-cue-bars"
      data-side={side}
      className="pointer-events-none flex h-full w-16 flex-none flex-col items-center gap-1"
      style={{ visibility: 'hidden' }}
    >
      {lastBar === 'top' && distance}
      <div className="flex w-full flex-1 flex-col gap-1">
        {Array.from({ length: BRAKE_CUE_BAR_COUNT }, (_, i) => (
          <div
            key={i}
            ref={(el) => {
              barsRef.current[i] = el;
            }}
            className="w-full flex-1 rounded-[1px]"
            style={{ backgroundColor: BRAKE_CUE_UNLIT_COLOR }}
          />
        ))}
      </div>
      {lastBar === 'bottom' && distance}
    </div>
  );
};
