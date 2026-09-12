import { useEffect, useRef } from 'react';
import type { Meta, StoryObj } from '@storybook/react-vite';
import type { BrakeCueTone } from '@irdashies/types';
import {
  BrakeCueBars,
  BRAKE_CUE_UNLIT_COLOR,
  brakeCueColor,
  isBrakeCueBarLit,
  isBrakeCueHorizontal,
  type BrakeCueBarSide,
} from './BrakeCueBars';

/**
 * The strip is driven imperatively by the countdown loop, so these stories pin
 * it to one rung of the ladder by writing the same DOM the loop would.
 */
const Ladder = ({
  bars,
  tone,
  side = 'right',
  lastBar = 'top',
  progress = 0,
  distanceM,
}: {
  bars: number;
  tone: BrakeCueTone;
  side?: BrakeCueBarSide;
  lastBar?: 'top' | 'bottom';
  /** Horizontal sides only: how far the fill has progressed, 0..1. */
  progress?: number;
  /** Metres remaining. Omit to leave the readout blank. */
  distanceM?: number;
}) => {
  const strip = useRef<HTMLDivElement>(null);
  const barRefs = useRef<(HTMLDivElement | null)[]>([]);
  const fill = useRef<HTMLDivElement>(null);
  const distance = useRef<HTMLSpanElement>(null);
  const horizontal = isBrakeCueHorizontal(side);

  useEffect(() => {
    if (strip.current) {
      strip.current.style.visibility = bars > 0 ? 'visible' : 'hidden';
    }

    if (horizontal) {
      if (fill.current) {
        fill.current.style.width = `${Math.round(progress * 100)}%`;
        fill.current.style.backgroundColor =
          bars > 0 ? brakeCueColor(tone) : BRAKE_CUE_UNLIT_COLOR;
      }
    } else {
      const lit = brakeCueColor(tone);
      barRefs.current.forEach((el, i) => {
        if (el) {
          el.style.backgroundColor = isBrakeCueBarLit(i, bars, lastBar)
            ? lit
            : BRAKE_CUE_UNLIT_COLOR;
        }
      });
    }

    if (distance.current) {
      const text =
        tone === 'red' ? 'BRAKE' : distanceM != null ? `${distanceM}m` : '';
      distance.current.textContent = text;
      if (text) distance.current.style.color = brakeCueColor(tone);
    }
  }, [bars, tone, side, lastBar, progress, distanceM, horizontal]);

  const stripElement = (
    <BrakeCueBars
      stripRef={strip}
      barsRef={barRefs}
      fillRef={fill}
      distanceRef={distance}
      side={side}
      lastBar={lastBar}
    />
  );

  return (
    <div className="flex h-[120px] w-[396px] flex-col rounded-sm bg-slate-900 p-1.5">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">
        Best Lap
      </div>
      {horizontal ? (
        <div className="flex flex-1 flex-col gap-1.5">
          {side === 'top' && stripElement}
          <div className="flex-1 rounded-sm bg-slate-800/60" />
          {side === 'bottom' && stripElement}
        </div>
      ) : (
        <div className="flex flex-1 flex-row gap-1.5">
          {side === 'left' && stripElement}
          <div className="flex-1 rounded-sm bg-slate-800/60" />
          {side === 'right' && stripElement}
        </div>
      )}
    </div>
  );
};

export default {
  component: Ladder,
  title: 'widgets/LapTrace/BrakeCueBars',
} as Meta<typeof Ladder>;

type Story = StoryObj<typeof Ladder>;

/** More than 3s out: the full stack, green, just inside the arm window. */
export const Armed: Story = {
  args: { bars: 4, tone: 'green', progress: 0.12, distanceM: 220 },
};

/** 3 seconds. */
export const ThreeSeconds: Story = {
  args: { bars: 3, tone: 'green', progress: 0.44, distanceM: 140 },
};

/** 2 seconds — the stack starts warming. */
export const TwoSeconds: Story = {
  args: { bars: 2, tone: 'amber', progress: 0.68, distanceM: 80 },
};

/** 1 second. */
export const OneSecond: Story = {
  args: { bars: 1, tone: 'orange', progress: 0.88, distanceM: 30 },
};

/** The brake point itself: the last bar turns red and the readout reads "BRAKE". */
export const BrakeNow: Story = {
  args: { bars: 1, tone: 'red', progress: 1, distanceM: 0 },
};

/** Between braking zones. */
export const Hidden: Story = { args: { bars: 0, tone: 'off' } };

/** Anchored to the left edge instead. */
export const LeftSide: Story = {
  args: { bars: 2, tone: 'amber', side: 'left', progress: 0.68, distanceM: 80 },
};

/** The distance readout sits at the bottom when the final bar drains there. */
export const FinalBarAtBottom: Story = {
  args: {
    bars: 2,
    tone: 'amber',
    lastBar: 'bottom',
    progress: 0.68,
    distanceM: 80,
  },
};

/**
 * A single continuous bar spanning the widget's width instead of 4 discrete
 * ones, for the top/bottom placements.
 */
export const HorizontalTop: Story = {
  args: { bars: 2, tone: 'amber', side: 'top', progress: 0.68, distanceM: 80 },
};

/** Same continuous bar, anchored under the trace instead of above it. */
export const HorizontalBottom: Story = {
  args: {
    bars: 3,
    tone: 'green',
    side: 'bottom',
    progress: 0.44,
    distanceM: 140,
  },
};

/** The horizontal bar fully filled and red at the brake point. */
export const HorizontalBrakeNow: Story = {
  args: { bars: 1, tone: 'red', side: 'top', progress: 1, distanceM: 0 },
};
