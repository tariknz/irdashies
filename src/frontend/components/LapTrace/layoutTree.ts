import type { LapTraceConfig, LayoutNode } from '@irdashies/types';
import { hasLayoutTree, layoutTreeHas } from '@irdashies/domain/layoutTree';

export type LapTraceElementId = 'plot' | 'corners' | 'brakeCue';

export const LAP_TRACE_ELEMENTS: { id: LapTraceElementId; label: string }[] = [
  { id: 'plot', label: 'Trace' },
  { id: 'corners', label: 'Last Corner' },
  { id: 'brakeCue', label: 'Countdown Bars' },
];

/** Which side of what it shares room with an element sits on. */
export type LapTraceElementSide = 'left' | 'right' | 'top' | 'bottom';

type LegacyLayoutConfig = Partial<
  Pick<
    LapTraceConfig,
    'showLastCorner' | 'lastCornerPosition' | 'brakeCueBars' | 'brakeCueBarSide'
  >
>;

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
 * Builds a tree that matches the layout from before the layout editor: the
 * countdown strip beside or across the plot, and the last-corner panel
 * outside both, on the edges the old settings named.
 */
export const buildDefaultLapTraceTree = (
  config: LegacyLayoutConfig
): LayoutNode => {
  const corners = config.showLastCorner
    ? (config.lastCornerPosition ?? 'bottom')
    : undefined;
  const bars = config.brakeCueBars
    ? (config.brakeCueBarSide ?? 'right')
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

/** The saved tree, or one built from the old settings when there is none. */
export const getLapTraceLayoutTree = (
  config: LegacyLayoutConfig & { layoutTree?: LayoutNode }
): LayoutNode =>
  hasLayoutTree(config.layoutTree)
    ? config.layoutTree
    : buildDefaultLapTraceTree(config);

/** One container's entries, as subtrees or as an element of a box. */
const entriesOf = (node: LayoutNode): (LayoutNode | string)[] =>
  node.type === 'box' ? [...new Set(node.widgets)] : node.children;

const entryHas = (entry: LayoutNode | string, element: string): boolean =>
  typeof entry === 'string' ? entry === element : layoutTreeHas(entry, element);

/** The containers from the root down to the element, innermost last. */
const pathTo = (node: LayoutNode, element: string): LayoutNode[] => {
  if (!layoutTreeHas(node, element)) return [];
  if (node.type === 'box') return [node];
  const child = node.children.find((c) => layoutTreeHas(c, element));
  return child ? [node, ...pathTo(child, element)] : [node];
};

/**
 * Which side an element sits on, read off the innermost container where it
 * shares room with something else: a row puts it left or right, a column
 * above or below. Left or above when it comes before the plot, or first when
 * the plot is not in that container. Undefined when the element is not in the
 * tree or has it to itself.
 *
 * The panel and the countdown strip take their orientation from this: beside
 * the plot they run full height, above or below it they run across.
 */
export const lapTraceElementSide = (
  tree: LayoutNode,
  element: LapTraceElementId
): LapTraceElementSide | undefined => {
  const path = pathTo(tree, element);
  for (let depth = path.length - 1; depth >= 0; depth -= 1) {
    const container = path[depth];
    const entries = entriesOf(container);
    if (entries.length < 2) continue;
    const index = entries.findIndex((entry) => entryHas(entry, element));
    const plotIndex = entries.findIndex(
      (entry, i) => i !== index && entryHas(entry, 'plot')
    );
    const leading = plotIndex >= 0 ? index < plotIndex : index === 0;
    if (container.direction === 'row') return leading ? 'left' : 'right';
    return leading ? 'top' : 'bottom';
  }
  return undefined;
};
