import { describe, expect, it } from 'vitest';
import { getWidgetDefaultConfig, type LayoutNode } from '@irdashies/types';
import { layoutTreeHas } from '@irdashies/domain/layoutTree';
import {
  buildDefaultLapTraceTree,
  getLapTraceLayoutTree,
  lapTraceElementSide,
} from './layoutTree';

const box = (
  widgets: string[],
  direction: 'row' | 'col' = 'col'
): LayoutNode => ({
  id: `box-${widgets.join('-')}`,
  type: 'box',
  direction,
  widgets,
});

const split = (
  direction: 'row' | 'col',
  children: LayoutNode[]
): LayoutNode => ({
  id: `split-${children.map((c) => c.id).join('-')}`,
  type: 'split',
  direction,
  children,
});

const SIDES = ['top', 'bottom', 'left', 'right'] as const;

describe('buildDefaultLapTraceTree', () => {
  it('starts a new widget with the panel, the trace and the countdown in three columns', () => {
    const tree = buildDefaultLapTraceTree(getWidgetDefaultConfig('laptrace'));
    expect(tree).toMatchObject({
      type: 'split',
      children: [
        {
          direction: 'row',
          children: [
            { widgets: ['corners'] },
            { widgets: ['plot'] },
            { widgets: ['brakeCue'] },
          ],
        },
      ],
    });
  });

  it('holds only the trace with the panel and the countdown off', () => {
    const tree = buildDefaultLapTraceTree({});
    expect(layoutTreeHas(tree, 'plot')).toBe(true);
    expect(layoutTreeHas(tree, 'corners')).toBe(false);
    expect(layoutTreeHas(tree, 'brakeCue')).toBe(false);
    // A split at the root, as the editor expects.
    expect(tree.type).toBe('split');
  });

  it.each(SIDES.flatMap((corners) => SIDES.map((bars) => [corners, bars])))(
    'puts a %s panel and %s bars where the old settings did',
    (corners, bars) => {
      const tree = buildDefaultLapTraceTree({
        showLastCorner: true,
        lastCornerPosition: corners,
        brakeCueBars: true,
        brakeCueBarSide: bars,
      });
      expect(lapTraceElementSide(tree, 'corners')).toBe(corners);
      expect(lapTraceElementSide(tree, 'brakeCue')).toBe(bars);
    }
  );

  it('keeps a side panel outside side bars on the same edge', () => {
    const tree = buildDefaultLapTraceTree({
      showLastCorner: true,
      lastCornerPosition: 'right',
      brakeCueBars: true,
      brakeCueBarSide: 'right',
    });
    // The bars are a live cue tied to the trace, so they stay closest to it.
    expect(tree).toMatchObject({
      children: [
        {
          direction: 'row',
          children: [
            { widgets: ['plot'] },
            { widgets: ['brakeCue'] },
            { widgets: ['corners'] },
          ],
        },
      ],
    });
  });

  it('keeps a top or bottom strip in the trace column, beside a side panel', () => {
    const tree = buildDefaultLapTraceTree({
      showLastCorner: true,
      lastCornerPosition: 'left',
      brakeCueBars: true,
      brakeCueBarSide: 'bottom',
    });
    expect(tree).toMatchObject({
      children: [
        {
          direction: 'row',
          children: [
            { widgets: ['corners'] },
            {
              direction: 'col',
              children: [{ widgets: ['plot'] }, { widgets: ['brakeCue'] }],
            },
          ],
        },
      ],
    });
  });
});

describe('getLapTraceLayoutTree', () => {
  it('uses a saved tree over the old settings', () => {
    const saved = split('row', [box(['corners']), box(['plot'])]);
    expect(
      getLapTraceLayoutTree({ layoutTree: saved, showLastCorner: false })
    ).toBe(saved);
  });

  it('falls back to the old settings without a valid tree', () => {
    for (const layoutTree of [
      undefined,
      { id: 'x' } as unknown as LayoutNode,
    ]) {
      const tree = getLapTraceLayoutTree({
        layoutTree,
        showLastCorner: true,
        lastCornerPosition: 'top',
      });
      expect(lapTraceElementSide(tree, 'corners')).toBe('top');
    }
  });
});

describe('lapTraceElementSide', () => {
  it('reads the side off the innermost container the element shares', () => {
    const tree = split('col', [
      split('row', [box(['plot']), box(['corners'])]),
      box(['brakeCue']),
    ]);
    expect(lapTraceElementSide(tree, 'corners')).toBe('right');
    expect(lapTraceElementSide(tree, 'brakeCue')).toBe('bottom');
  });

  it('reads a box holding several elements by its own direction', () => {
    const tree = split('col', [box(['corners', 'plot'], 'row')]);
    expect(lapTraceElementSide(tree, 'corners')).toBe('left');
  });

  it('places by order where the trace is not alongside', () => {
    const tree = split('row', [
      box(['plot']),
      split('col', [box(['corners']), box(['brakeCue'])]),
    ]);
    // Stacked with each other beside the trace: the first is above.
    expect(lapTraceElementSide(tree, 'corners')).toBe('top');
    expect(lapTraceElementSide(tree, 'brakeCue')).toBe('bottom');
  });

  it('has no side for an element alone or missing', () => {
    expect(
      lapTraceElementSide(split('col', [box(['corners'])]), 'corners')
    ).toBeUndefined();
    expect(
      lapTraceElementSide(split('col', [box(['plot'])]), 'corners')
    ).toBeUndefined();
  });
});
