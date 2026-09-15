import { createRef } from 'react';
import { render, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { DEFAULT_LAP_TRACE_COLORS } from '@irdashies/types';
import {
  BrakeCueBars,
  BRAKE_CUE_BAR_COUNT,
  BRAKE_CUE_UNLIT_COLOR,
  brakeCueColor,
  isBrakeCueBarLit,
  isBrakeCueHorizontal,
  type BrakeCueBarSide,
} from './BrakeCueBars';

/** Which bar indices are lit, top to bottom. */
const litIndices = (bars: number, lastBar: 'top' | 'bottom') =>
  Array.from({ length: BRAKE_CUE_BAR_COUNT }, (_, i) => i).filter((i) =>
    isBrakeCueBarLit(i, bars, lastBar)
  );

const renderStrip = (
  side: BrakeCueBarSide = 'right',
  lastBar: 'top' | 'bottom' = 'top'
) => {
  const stripRef = createRef<HTMLDivElement>();
  const barsRef = { current: [] as (HTMLDivElement | null)[] };
  const fillRef = createRef<HTMLDivElement>();
  const distanceRef = createRef<HTMLSpanElement>();
  const utils = render(
    <BrakeCueBars
      stripRef={stripRef}
      barsRef={barsRef}
      fillRef={fillRef}
      distanceRef={distanceRef}
      side={side}
      lastBar={lastBar}
    />
  );
  return { ...utils, stripRef, barsRef, fillRef, distanceRef };
};

describe('isBrakeCueHorizontal', () => {
  it('is true only for the top/bottom sides', () => {
    expect(isBrakeCueHorizontal('top')).toBe(true);
    expect(isBrakeCueHorizontal('bottom')).toBe(true);
    expect(isBrakeCueHorizontal('left')).toBe(false);
    expect(isBrakeCueHorizontal('right')).toBe(false);
  });
});

describe('BrakeCueBars', () => {
  afterEach(cleanup);

  describe('vertical (left/right)', () => {
    it('renders the full stack of bars', () => {
      const { barsRef } = renderStrip('right');

      expect(barsRef.current).toHaveLength(BRAKE_CUE_BAR_COUNT);
      expect(barsRef.current.every(Boolean)).toBe(true);
    });

    it('runs the full height of the plot', () => {
      const { stripRef } = renderStrip('right');

      expect(stripRef.current?.className).toContain('h-full');
      // Wider than tall so a single bar reads as a rectangle, not a square.
      expect(stripRef.current?.className).toContain('w-16');
    });

    it('starts hidden until a brake point is near', () => {
      const { stripRef } = renderStrip('right');

      expect(stripRef.current?.style.visibility).toBe('hidden');
    });

    it('reserves its footprint even while hidden, so the plot never resizes', () => {
      const { stripRef } = renderStrip('right');

      // display:none would collapse the column and shift the trace sideways at
      // every corner; visibility keeps the space.
      expect(stripRef.current?.style.display).not.toBe('none');
      expect(stripRef.current?.className).toContain('flex-none');
    });

    it('sits beside the plot rather than on top of it', () => {
      const { stripRef } = renderStrip('right');

      expect(stripRef.current?.className).not.toContain('absolute');
    });

    it('does not intercept clicks over the plot', () => {
      const { stripRef } = renderStrip('right');

      expect(stripRef.current?.className).toContain('pointer-events-none');
    });

    it('drains downwards so the final bar is the top one', () => {
      expect(litIndices(4, 'top')).toEqual([0, 1, 2, 3]);
      expect(litIndices(3, 'top')).toEqual([0, 1, 2]);
      expect(litIndices(2, 'top')).toEqual([0, 1]);
      // The last bar standing — the one that turns red — sits at the top.
      expect(litIndices(1, 'top')).toEqual([0]);
      expect(litIndices(0, 'top')).toEqual([]);
    });

    it('drains upwards when the final bar is the bottom one', () => {
      expect(litIndices(4, 'bottom')).toEqual([0, 1, 2, 3]);
      expect(litIndices(3, 'bottom')).toEqual([1, 2, 3]);
      expect(litIndices(2, 'bottom')).toEqual([2, 3]);
      expect(litIndices(1, 'bottom')).toEqual([3]);
      expect(litIndices(0, 'bottom')).toEqual([]);
    });

    it('places the distance readout at the top when the final bar is the top one', () => {
      const { stripRef, distanceRef } = renderStrip('right', 'top');

      const children = Array.from(stripRef.current?.children ?? []);
      expect(children[0]).toBe(distanceRef.current);
    });

    it('places the distance readout at the bottom when the final bar is the bottom one', () => {
      const { stripRef, distanceRef } = renderStrip('right', 'bottom');

      const children = Array.from(stripRef.current?.children ?? []);
      expect(children[children.length - 1]).toBe(distanceRef.current);
    });
  });

  describe('horizontal (top/bottom)', () => {
    it('spans the full width as a single continuous bar', () => {
      const { stripRef } = renderStrip('top');

      expect(stripRef.current?.className).toContain('w-full');
      expect(stripRef.current?.className).toContain('flex-none');
    });

    it('renders one fill element rather than discrete bars', () => {
      const { barsRef, fillRef } = renderStrip('bottom');

      expect(barsRef.current.filter(Boolean)).toHaveLength(0);
      expect(fillRef.current).toBeTruthy();
    });

    it('starts with no progress and hidden', () => {
      const { stripRef, fillRef } = renderStrip('top');

      expect(stripRef.current?.style.visibility).toBe('hidden');
      expect(fillRef.current?.style.width).toBe('0%');
    });

    it('puts the distance readout on the right', () => {
      const { stripRef, distanceRef } = renderStrip('top');

      const children = Array.from(stripRef.current?.children ?? []);
      expect(children[children.length - 1]).toBe(distanceRef.current);
      expect(distanceRef.current?.className).toContain('text-right');
    });

    it('does not intercept clicks over the plot', () => {
      const { stripRef } = renderStrip('bottom');

      expect(stripRef.current?.className).toContain('pointer-events-none');
    });
  });

  it('exposes a distinct colour for every step of the ladder', () => {
    const tones = ['green', 'amber', 'orange', 'red'] as const;
    const colours = tones.map((tone) => brakeCueColor(tone));

    expect(new Set(colours).size).toBe(tones.length);
    expect(brakeCueColor('red')).toBe(DEFAULT_LAP_TRACE_COLORS.brakeCueRed);
    expect(brakeCueColor('green')).toBe(DEFAULT_LAP_TRACE_COLORS.brakeCueGreen);
  });

  it('reads its colours from the config passed in, not just the defaults', () => {
    const colors = {
      brakeCueGreen: '#111111',
      brakeCueAmber: '#222222',
      brakeCueOrange: '#333333',
      brakeCueRed: '#444444',
    };

    expect(brakeCueColor('green', colors)).toBe('#111111');
    expect(brakeCueColor('amber', colors)).toBe('#222222');
    expect(brakeCueColor('orange', colors)).toBe('#333333');
    expect(brakeCueColor('red', colors)).toBe('#444444');
  });

  it('never treats the unlit track colour as user-configurable', () => {
    expect(brakeCueColor('off')).toBe(BRAKE_CUE_UNLIT_COLOR);
  });
});
