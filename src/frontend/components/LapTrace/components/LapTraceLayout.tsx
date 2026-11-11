import { useMemo, type ReactNode } from 'react';
import type { LayoutNode } from '@irdashies/types';
import {
  layoutTreeHas,
  withoutRepeatedElements,
} from '@irdashies/domain/layoutTree';

interface Container {
  direction: 'row' | 'col';
  /** The element whose entry takes the container's free room. */
  filler: string;
  /** Whether the countdown strip runs along this container's direction. */
  barsAlong: boolean;
}

/**
 * The container a node lays its entries out in.
 *
 * Its free room goes to the plot when it holds it. Without the plot, it goes
 * to the countdown strip when the strip runs along the container (the bars
 * of a column stacked under the panel beside the trace), and otherwise to the
 * corner panel, so a layout with no trace still fills the widget.
 */
const containerOf = (node: LayoutNode, barsVertical: boolean): Container => {
  const barsAlong = barsVertical
    ? node.direction === 'col'
    : node.direction === 'row';
  const filler = layoutTreeHas(node, 'plot')
    ? 'plot'
    : barsAlong && layoutTreeHas(node, 'brakeCue')
      ? 'brakeCue'
      : layoutTreeHas(node, 'corners')
        ? 'corners'
        : 'brakeCue';
  return { direction: node.direction, filler, barsAlong };
};

/**
 * Sizing for one entry of a container. The editor sets no weights, so this
 * is the whole rule:
 *
 * - The entry holding the container's filler takes the free room. The plot,
 *   or a strip filling its container, keeps 40% of a row whatever sits
 *   beside it, and 60% of a column: there each carries a part that does not
 *   shrink (the plot's gear and distance labels, the strip's readout), and
 *   at 40% of the default 120px the trace itself was left a few pixels tall.
 *   The panel's rows are short, so it still shows the newest corner.
 * - The corner panel gives way: its entry starts at the panel's natural size
 *   and shrinks, and the panel drops columns or rows to fit what is left.
 * - The countdown strip never does, since a squeezed meter stops reading as a
 *   countdown. Alone in its entry it keeps its size. Sharing an entry with
 *   the panel, that entry never shrinks below the strip's thickness: 64px for
 *   the bars' column (BrakeCueBars' w-16), 20px for the bar across (h-5).
 *
 * Only the root, which the widget gives everything under its header, fills
 * regardless.
 */
const entrySizing = (
  holds: (element: string) => boolean,
  parent: Container | null
): string => {
  if (!parent) return 'flex-1 min-h-0 min-w-0';
  const row = parent.direction === 'row';
  const cross = row ? 'min-h-0' : 'min-w-0';
  if (holds(parent.filler)) {
    const keeps =
      parent.filler === 'plot' ||
      (parent.filler === 'brakeCue' && parent.barsAlong);
    const main = keeps
      ? row
        ? 'min-w-[40%]'
        : 'min-h-[60%]'
      : row
        ? 'min-w-0'
        : 'min-h-0';
    return `flex-1 ${main} ${cross}`;
  }
  const keepsBars = holds('brakeCue') && !parent.barsAlong;
  const main = keepsBars
    ? row
      ? 'min-w-16'
      : 'min-h-5'
    : row
      ? 'min-w-0'
      : 'min-h-0';
  const grow = holds('corners') ? 'flex-initial' : 'flex-none';
  return `${grow} ${main} ${cross}`;
};

interface LayoutNodeViewProps {
  node: LayoutNode;
  parent: Container | null;
  barsVertical: boolean;
  renderElement: (id: string) => ReactNode;
}

/**
 * One node of the layout tree. Declared at module level so its identity is
 * stable. A component declared inside render would remount the plot and the
 * panels every frame.
 */
const LayoutNodeView = ({
  node,
  parent,
  barsVertical,
  renderElement,
}: LayoutNodeViewProps) => {
  const self = containerOf(node, barsVertical);
  const className = [
    'flex overflow-hidden',
    node.direction === 'row' ? 'flex-row gap-1.5' : 'flex-col gap-1',
    entrySizing((element) => layoutTreeHas(node, element), parent),
  ].join(' ');

  if (node.type === 'box') {
    const elements = [...new Set(node.widgets)];
    // One element sits straight in its box, which carries its sizing. The
    // panel and the countdown column run full height beside the trace, and
    // that height has to come from a parent the row stretches: inside a
    // wrapper sized to its content the panel measured too little room and
    // dropped to one row, and the bars collapsed to their readout.
    if (elements.length === 1) {
      return <div className={className}>{renderElement(elements[0])}</div>;
    }
    return (
      <div className={className}>
        {elements.map((id) => (
          <div
            key={id}
            className={`flex flex-col overflow-hidden ${entrySizing(
              (element) => element === id,
              self
            )}`}
          >
            {renderElement(id)}
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={className}>
      {node.children.map((child) => (
        <LayoutNodeView
          key={child.id}
          node={child}
          parent={self}
          barsVertical={barsVertical}
          renderElement={renderElement}
        />
      ))}
    </div>
  );
};

export interface LapTraceLayoutProps {
  tree: LayoutNode;
  /**
   * Whether the countdown strip runs as a column of bars (beside the trace)
   * or one bar across (above or below it).
   */
  barsVertical: boolean;
  /** The plot ('plot'), the corner panel ('corners') or the strip ('brakeCue'). */
  renderElement: (id: string) => ReactNode;
}

/**
 * Lays the lap trace's elements out as the layout tree says. An element the
 * tree holds twice is drawn where it first appears only: two countdowns would
 * each run their own telemetry loop and play every tone twice.
 */
export const LapTraceLayout = ({
  tree,
  barsVertical,
  renderElement,
}: LapTraceLayoutProps) => {
  const drawn = useMemo(() => withoutRepeatedElements(tree), [tree]);
  return (
    <LayoutNodeView
      node={drawn}
      parent={null}
      barsVertical={barsVertical}
      renderElement={renderElement}
    />
  );
};
