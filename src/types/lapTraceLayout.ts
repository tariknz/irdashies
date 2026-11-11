import type { LayoutNode } from './widgetConfigs';

/**
 * The lap trace's layout elements: the plot, the last-corner panel and the
 * countdown strip.
 */
export type LapTraceElementId = 'plot' | 'corners' | 'brakeCue';

/**
 * The four settings that placed the last-corner panel and the countdown strip
 * before the layout editor. No current config carries them: the dashboard-load
 * migration turns them into a layout tree and drops them.
 */
export interface LapTraceLegacyLayout {
  showLastCorner?: boolean;
  lastCornerPosition?: 'top' | 'bottom' | 'left' | 'right';
  brakeCueBars?: boolean;
  brakeCueBarSide?: 'left' | 'right' | 'top' | 'bottom';
}

const box = (element: LapTraceElementId): LayoutNode => ({
  id: `laptrace-box-${element}`,
  type: 'box',
  direction: 'col',
  widgets: [element],
});

/** A split, or its only child when there is just one. */
const split = (
  id: string,
  direction: 'row' | 'col',
  children: (LayoutNode | false)[]
): LayoutNode => {
  const present = children.filter((child) => child !== false);
  return present.length === 1
    ? present[0]
    : { id, type: 'split', direction, children: present };
};

/**
 * Builds the tree that matches a layout from before the layout editor: the
 * countdown strip beside or across the plot, and the last-corner panel
 * outside both, on the edges the old settings named. A setting that is
 * missing counts as what it defaulted to then: no panel, below the trace; no
 * strip, on the right.
 */
export const lapTraceTreeFromLegacy = (
  legacy: LapTraceLegacyLayout
): LayoutNode => {
  const corners = legacy.showLastCorner
    ? (legacy.lastCornerPosition ?? 'bottom')
    : undefined;
  const bars = legacy.brakeCueBars
    ? (legacy.brakeCueBarSide ?? 'right')
    : undefined;

  // A top or bottom strip shares the plot's column, so it spans only the
  // trace and not a side panel.
  const plotColumn = split('laptrace-plot-column', 'col', [
    bars === 'top' && box('brakeCue'),
    box('plot'),
    bars === 'bottom' && box('brakeCue'),
  ]);
  // A side panel sits outside side bars: the bars are a live cue tied to the
  // trace, the panel is history.
  const middle = split('laptrace-middle', 'row', [
    corners === 'left' && box('corners'),
    bars === 'left' && box('brakeCue'),
    plotColumn,
    bars === 'right' && box('brakeCue'),
    corners === 'right' && box('corners'),
  ]);
  return {
    id: 'laptrace-root',
    type: 'split',
    direction: 'col',
    children: [
      ...(corners === 'top' ? [box('corners')] : []),
      middle,
      ...(corners === 'bottom' ? [box('corners')] : []),
    ],
  };
};

/**
 * The layout a new widget starts from and Reset to Default Layout restores:
 * the last-corner panel, the trace and the countdown in three columns.
 */
export const DEFAULT_LAP_TRACE_LAYOUT_TREE: LayoutNode = lapTraceTreeFromLegacy(
  {
    showLastCorner: true,
    lastCornerPosition: 'left',
    brakeCueBars: true,
    brakeCueBarSide: 'right',
  }
);
