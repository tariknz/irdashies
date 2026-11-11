import { describe, it, expect } from 'vitest';
import {
  DEFAULT_LAP_TRACE_LAYOUT_TREE,
  layoutTreeHas,
  type LayoutNode,
} from '@irdashies/types';
import { migrateLapTraceLayout } from './lapTraceLayoutMigration';

const LEGACY_KEYS = [
  'showLastCorner',
  'lastCornerPosition',
  'brakeCueBars',
  'brakeCueBarSide',
];

const treeOf = (config: unknown): LayoutNode =>
  (config as { layoutTree: LayoutNode }).layoutTree;

/** The ids of the boxes, in document order, as a picture of the layout. */
const boxesOf = (node: LayoutNode): string[] =>
  node.type === 'box' ? node.widgets : node.children.flatMap(boxesOf);

describe('migrateLapTraceLayout', () => {
  it('builds the tree from the old settings and drops them', () => {
    const migrated = migrateLapTraceLayout({
      metersAhead: 300,
      showLastCorner: true,
      lastCornerPosition: 'right',
      brakeCueBars: true,
      brakeCueBarSide: 'left',
    }) as Record<string, unknown>;

    // Bars left of the trace, the panel outside them on the right.
    expect(boxesOf(treeOf(migrated))).toEqual(['brakeCue', 'plot', 'corners']);
    expect(migrated.metersAhead).toBe(300);
    for (const key of LEGACY_KEYS) expect(migrated).not.toHaveProperty(key);
  });

  it('keeps an old config that showed neither as the trace alone', () => {
    const tree = treeOf(
      migrateLapTraceLayout({
        showLastCorner: false,
        lastCornerPosition: 'bottom',
        brakeCueBars: false,
        brakeCueBarSide: 'right',
      })
    );
    expect(layoutTreeHas(tree, 'plot')).toBe(true);
    expect(layoutTreeHas(tree, 'corners')).toBe(false);
    expect(layoutTreeHas(tree, 'brakeCue')).toBe(false);
  });

  it('reads missing settings as their old defaults, not the new layout', () => {
    // An export from before the settings existed: no panel, no strip.
    const tree = treeOf(migrateLapTraceLayout({ metersAhead: 200 }));
    expect(boxesOf(tree)).toEqual(['plot']);
    expect(tree).not.toEqual(DEFAULT_LAP_TRACE_LAYOUT_TREE);

    // A panel switched on with no position went below the trace.
    const below = treeOf(migrateLapTraceLayout({ showLastCorner: true }));
    expect(boxesOf(below)).toEqual(['plot', 'corners']);
  });

  it('treats a value of the wrong type as missing', () => {
    const tree = treeOf(
      migrateLapTraceLayout({
        showLastCorner: 'yes',
        lastCornerPosition: 'middle',
        brakeCueBars: true,
        brakeCueBarSide: 42,
      })
    );
    // No panel; the strip on its old default side, the right.
    expect(boxesOf(tree)).toEqual(['plot', 'brakeCue']);
  });

  it('keeps a saved tree over the old settings, and drops the settings', () => {
    const saved: LayoutNode = {
      id: 'mine',
      type: 'split',
      direction: 'col',
      children: [
        { id: 'p', type: 'box', direction: 'col', widgets: ['plot'] },
        { id: 'c', type: 'box', direction: 'col', widgets: ['corners'] },
      ],
    };
    const migrated = migrateLapTraceLayout({
      layoutTree: saved,
      showLastCorner: false,
      brakeCueBars: true,
    }) as Record<string, unknown>;
    expect(migrated.layoutTree).toBe(saved);
    for (const key of LEGACY_KEYS) expect(migrated).not.toHaveProperty(key);
  });

  it('drops a damaged tree so the default fills it in', () => {
    const migrated = migrateLapTraceLayout({
      metersAhead: 200,
      layoutTree: { id: 'broken', type: 'box' },
    }) as Record<string, unknown>;
    expect(migrated).not.toHaveProperty('layoutTree');
    expect(migrated.metersAhead).toBe(200);
  });

  it('changes nothing the second time', () => {
    const once = migrateLapTraceLayout({
      showLastCorner: true,
      lastCornerPosition: 'top',
      brakeCueBars: true,
      brakeCueBarSide: 'bottom',
    });
    expect(migrateLapTraceLayout(once)).toBe(once);
    expect(migrateLapTraceLayout(once)).toEqual(once);
  });

  it('leaves a config that is not an object to the defaults', () => {
    expect(migrateLapTraceLayout(undefined)).toBeUndefined();
    expect(migrateLapTraceLayout(null)).toBeNull();
  });
});
