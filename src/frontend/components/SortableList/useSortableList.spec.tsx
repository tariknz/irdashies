import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useSortableList } from './useSortableList';

const initialItems = ['position', 'carNumber', 'driverName'];

function setup(heights = [40, 40, 40]) {
  const onReorder = vi.fn();
  function Harness() {
    const [items, setItems] = useState(initialItems);
    const { displayItems, getItemProps } = useSortableList({
      items,
      getItemId: (id) => id,
      onReorder: (next) => {
        onReorder(next);
        setItems(next);
      },
    });
    return displayItems.map((id) => {
      const { itemProps, dragHandleProps } = getItemProps(id);
      return (
        <div key={id} {...itemProps}>
          <div data-testid={id} {...dragHandleProps}>
            <span>{id}</span>
          </div>
        </div>
      );
    });
  }
  const { container } = render(<Harness />);
  const rows = () => [
    ...container.querySelectorAll<HTMLElement>('[data-sortable-id]'),
  ];
  const row = (id: string) => {
    const element = container.querySelector<HTMLElement>(
      `[data-sortable-id="${id}"]`
    );
    if (!element) throw new Error(`Missing sortable row: ${id}`);
    return element;
  };
  const heightOf = (element: HTMLElement) =>
    heights[initialItems.indexOf(element.dataset.sortableId ?? '')] ?? 0;
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      const ordered = rows();
      const index = ordered.indexOf(this);
      const top = ordered
        .slice(0, index)
        .reduce((sum, el) => sum + heightOf(el), 0);
      return new DOMRect(0, top, 300, heightOf(this));
    }
  );
  const dataTransfer = { setData: vi.fn(), setDragImage: vi.fn() };
  const start = (id: string) =>
    fireEvent.dragStart(screen.getByTestId(id), { dataTransfer });
  const hover = (id: string, clientY: number) =>
    fireEvent(
      screen.getByText(id),
      Object.assign(
        new Event('dragover', { bubbles: true, cancelable: true }),
        {
          clientY,
          dataTransfer,
        }
      )
    );
  return {
    start,
    hover,
    row,
    order: () => rows().map((el) => el.dataset.sortableId),
    onReorder,
    drop: (id: string) => fireEvent.drop(row(id), { dataTransfer }),
    cancel: (id: string) => fireEvent.dragEnd(screen.getByTestId(id)),
  };
}

describe('sortable list drag preview', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback(0);
      return 1;
    });
  });

  afterEach(() => vi.restoreAllMocks());

  it.each([
    {
      direction: 'down',
      source: 'position',
      beforeMidpoint: 50,
      pastMidpoint: 70,
      expected: ['carNumber', 'position', 'driverName'],
    },
    {
      direction: 'up',
      source: 'driverName',
      beforeMidpoint: 70,
      pastMidpoint: 50,
      expected: ['position', 'driverName', 'carNumber'],
    },
  ])(
    'waits for the midpoint moving $direction and stays stable on repeated drag-over events',
    ({ source, beforeMidpoint, pastMidpoint, expected }) => {
      const list = setup();
      list.start(source);
      list.hover('carNumber', beforeMidpoint);
      expect(list.order()).toEqual(initialItems);

      list.hover('carNumber', pastMidpoint);
      expect(list.order()).toEqual(expected);
      for (let i = 0; i < 6; i++) {
        list.hover('carNumber', pastMidpoint);
        expect(list.order()).toEqual(expected);
      }
      expect(list.onReorder).not.toHaveBeenCalled();
      list.drop(source);
      expect(list.onReorder).toHaveBeenCalledExactlyOnceWith(expected);
      expect(list.order()).toEqual(expected);
    }
  );

  it('does not oscillate when an expanded row moves past a shorter row', () => {
    const list = setup([160, 40, 40]);
    list.start('position');
    list.hover('carNumber', 190);
    const expected = ['carNumber', 'position', 'driverName'];
    expect(list.order()).toEqual(expected);
    for (let i = 0; i < 6; i++) {
      list.hover('carNumber', 190);
      expect(list.order()).toEqual(expected);
    }
  });

  it('allows reversing direction after crossing back over the moved target', () => {
    const list = setup();
    list.start('position');
    list.hover('carNumber', 70);
    expect(list.order()).toEqual(['carNumber', 'position', 'driverName']);
    list.hover('carNumber', 10);
    expect(list.order()).toEqual(initialItems);
  });

  it('restores the saved order when a drag is cancelled', () => {
    const list = setup();
    list.start('position');
    list.hover('driverName', 110);
    expect(list.order()).toEqual(['carNumber', 'driverName', 'position']);
    list.cancel('position');
    expect(list.order()).toEqual(initialItems);
    expect(list.onReorder).not.toHaveBeenCalled();
  });

  it('ignores external drags and hovering the dragged row itself', () => {
    const list = setup();
    list.hover('carNumber', 70);
    list.drop('carNumber');
    expect(list.order()).toEqual(initialItems);
    expect(list.onReorder).not.toHaveBeenCalled();
    list.start('position');
    list.hover('position', 30);
    expect(list.order()).toEqual(initialItems);
  });
});
