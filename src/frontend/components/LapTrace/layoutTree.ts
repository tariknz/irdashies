import {
  DEFAULT_LAP_TRACE_LAYOUT_TREE,
  type LapTraceElementId,
  type LayoutNode,
} from '@irdashies/types';
import { layoutTreeHas, resolveLayoutTree } from '@irdashies/domain/layoutTree';

export type { LapTraceElementId } from '@irdashies/types';

export const LAP_TRACE_ELEMENTS: { id: LapTraceElementId; label: string }[] = [
  { id: 'plot', label: 'Trace' },
  { id: 'corners', label: 'Last Corner' },
  { id: 'brakeCue', label: 'Countdown Bars' },
];

/** Which side of the trace an element sits on. */
export type LapTraceElementSide = 'left' | 'right' | 'top' | 'bottom';

const defaultTree = () => DEFAULT_LAP_TRACE_LAYOUT_TREE;

/**
 * The saved tree, or the default one when it is missing or damaged. Configs
 * saved before the layout editor get theirs from the dashboard-load migration.
 */
export const resolveLapTraceLayoutTree = (saved: unknown): LayoutNode =>
  resolveLayoutTree(saved, defaultTree);

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
 * Which side of the trace an element sits on, read off the innermost
 * container that holds both: a row puts it left or right of the trace, a
 * column above or below it. That holds however deep the element sits inside
 * its own branch, so a panel stacked with the bars beside the trace is still
 * beside it. Undefined when the tree has no trace, or not the element.
 *
 * The panel and the countdown strip take their orientation from this: beside
 * the plot they run full height, above or below it they run across.
 */
export const lapTraceElementSide = (
  tree: LayoutNode,
  element: LapTraceElementId
): LapTraceElementSide | undefined => {
  if (element === 'plot' || !layoutTreeHas(tree, 'plot')) return undefined;
  const path = pathTo(tree, element);
  for (let depth = path.length - 1; depth >= 0; depth -= 1) {
    const container = path[depth];
    if (!layoutTreeHas(container, 'plot')) continue;
    const entries = entriesOf(container);
    const index = entries.findIndex((entry) => entryHas(entry, element));
    const plotIndex = entries.findIndex((entry) => entryHas(entry, 'plot'));
    const before = index < plotIndex;
    if (container.direction === 'row') return before ? 'left' : 'right';
    return before ? 'top' : 'bottom';
  }
  return undefined;
};
