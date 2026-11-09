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

/** Which side of what it shares room with an element sits on. */
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
