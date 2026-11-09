import type { ReactNode } from 'react';
import type { LayoutNode } from '@irdashies/types';
import { layoutTreeHas } from '@irdashies/domain/layoutTree';

interface Container {
  direction: 'row' | 'col';
  holdsPlot: boolean;
}

/**
 * Sizing for one entry of a container. What holds the plot takes the free
 * room; everything else keeps its own size, since the panel and the countdown
 * strip size themselves and the editor sets no weights.
 *
 * Beside the plot, room runs short in a small widget: a side panel sized for a
 * long corner name is most of the default 396px, and three rows above or below
 * the trace are most of its 120px. The countdown strip never gives way, since
 * a squeezed meter stops reading as a countdown. The plot keeps a third of the
 * container, and the panel takes what is left, clipping inside its own box.
 */
const entrySizing = (
  holds: (element: string) => boolean,
  parent: Container
): string => {
  if (!parent.holdsPlot) {
    return `${holds('plot') ? 'flex-1' : 'flex-none'} min-h-0 min-w-0`;
  }
  if (holds('plot')) {
    return parent.direction === 'row'
      ? 'flex-1 min-w-[33%] min-h-0'
      : 'flex-1 min-h-[33%] min-w-0';
  }
  if (holds('corners')) return 'flex-initial min-h-0 min-w-0';
  return 'flex-none min-h-0 min-w-0';
};

interface LayoutNodeViewProps {
  node: LayoutNode;
  parent: Container;
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
  renderElement,
}: LayoutNodeViewProps) => {
  const self: Container = {
    direction: node.direction,
    holdsPlot: layoutTreeHas(node, 'plot'),
  };
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
          renderElement={renderElement}
        />
      ))}
    </div>
  );
};

/** The widget itself stacks the header and the layout in a column. */
const WIDGET_ROOT: Container = { direction: 'col', holdsPlot: false };

export interface LapTraceLayoutProps {
  tree: LayoutNode;
  /** The plot ('plot'), the corner panel ('corners') or the strip ('brakeCue'). */
  renderElement: (id: string) => ReactNode;
}

/** Lays the lap trace's elements out as the layout tree says. */
export const LapTraceLayout = ({
  tree,
  renderElement,
}: LapTraceLayoutProps) => (
  <LayoutNodeView
    node={tree}
    parent={WIDGET_ROOT}
    renderElement={renderElement}
  />
);
