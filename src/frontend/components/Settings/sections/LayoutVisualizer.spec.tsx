import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { LayoutNode } from '@irdashies/types';
import { arrangeLayoutItem, LayoutVisualizer } from './LayoutVisualizer';

const tree: LayoutNode = {
  id: 'root',
  type: 'split',
  direction: 'col',
  children: [
    { id: 'a', type: 'box', direction: 'row', widgets: ['throttle', 'brake'] },
    { id: 'b', type: 'box', direction: 'col', widgets: ['gear'] },
  ],
};
const widgets = [
  { id: 'throttle', label: 'Throttle' },
  { id: 'brake', label: 'Brake' },
  { id: 'gear', label: 'Gear' },
  { id: 'steer', label: 'Steering' },
];
const boxes = (node: LayoutNode): LayoutNode[] =>
  node.type === 'box' ? [node] : node.children.flatMap(boxes);
const contents = (node: LayoutNode) =>
  boxes(node).map((box) => (box.type === 'box' ? box.widgets : []));

describe('layout arrangement without dragging', () => {
  it('moves an individual item into a nested group and preserves the source tree', () => {
    const result = arrangeLayoutItem(
      tree,
      { boxId: 'a', widgetIndex: 1 },
      'b',
      'first'
    );
    expect(contents(result)).toEqual([['throttle'], ['brake', 'gear']]);
    expect(contents(tree)).toEqual([['throttle', 'brake'], ['gear']]);
  });
  it('moves a whole group and collapses its redundant parent', () => {
    const result = arrangeLayoutItem(tree, { boxId: 'a' }, 'b', 'last');
    expect(result.type).toBe('box');
    expect(contents(result)).toEqual([['gear', 'throttle', 'brake']]);
  });
  it.each(['top', 'bottom', 'left', 'right'] as const)(
    'splits a new item %s of a group',
    (placement) => {
      const result = arrangeLayoutItem(
        tree,
        { widgetId: 'steer' },
        'b',
        placement
      );
      expect(contents(result).flat().sort()).toEqual([
        'brake',
        'gear',
        'steer',
        'throttle',
      ]);
      const group =
        placement === 'left' || placement === 'right'
          ? result.type === 'split'
            ? result.children[1]
            : result
          : result;
      expect(group.type === 'split' && group.direction).toBe(
        placement === 'left' || placement === 'right' ? 'row' : 'col'
      );
    }
  );
  it('reorders within a group without duplicating the item', () => {
    expect(
      contents(
        arrangeLayoutItem(tree, { boxId: 'a', widgetIndex: 1 }, 'a', 'first')
      )
    ).toEqual([['brake', 'throttle'], ['gear']]);
  });
  it('does not remove an item when its destination is invalid', () => {
    expect(
      arrangeLayoutItem(tree, { boxId: 'a', widgetIndex: 0 }, 'missing', 'last')
    ).toBe(tree);
    expect(arrangeLayoutItem(tree, { boxId: 'a' }, 'a', 'last')).toBe(tree);
  });
  it('applies the native form with a keyboard and announces the result', async () => {
    const onChange = vi.fn();
    function Editor() {
      const [value, setValue] = useState(tree);
      return (
        <LayoutVisualizer
          tree={value}
          availableWidgets={widgets}
          onChange={(next) => {
            setValue(next);
            onChange(next);
          }}
        />
      );
    }
    render(<Editor />);
    await userEvent.click(screen.getByText('Arrange without dragging'));
    await userEvent.selectOptions(screen.getByLabelText('Item'), 'new-steer');
    await userEvent.selectOptions(
      screen.getByLabelText('Destination group'),
      'b'
    );
    const apply = screen.getByRole('button', { name: 'Apply arrangement' });
    apply.focus();
    await userEvent.keyboard('{Enter}');
    expect(contents(onChange.mock.calls[0][0])).toEqual([
      ['throttle', 'brake'],
      ['gear', 'steer'],
    ]);
    expect(screen.getByRole('status')).toHaveTextContent(
      'Steering (available) moved last in Group 2'
    );
    expect(apply).toHaveFocus();
  });
});
