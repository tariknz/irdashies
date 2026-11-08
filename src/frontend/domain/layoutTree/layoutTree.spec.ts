import { describe, expect, it } from 'vitest';
import type { LayoutNode } from '@irdashies/types';
import { layoutTreeHas } from './layoutTree';

const box = (id: string, widgets: string[]): LayoutNode => ({
  id,
  type: 'box',
  direction: 'col',
  widgets,
});

describe('layoutTreeHas', () => {
  const tree: LayoutNode = {
    id: 'root',
    type: 'split',
    direction: 'row',
    children: [
      box('a', ['plot']),
      {
        id: 'inner',
        type: 'split',
        direction: 'col',
        children: [box('b', ['corners', 'brakeCue'])],
      },
    ],
  };

  it('finds an element in a box at any depth', () => {
    expect(layoutTreeHas(tree, 'plot')).toBe(true);
    expect(layoutTreeHas(tree, 'brakeCue')).toBe(true);
  });

  it('says no for an element the tree does not hold', () => {
    expect(layoutTreeHas(tree, 'gear')).toBe(false);
    expect(
      layoutTreeHas(
        { id: 'root', type: 'split', direction: 'col', children: [] },
        'plot'
      )
    ).toBe(false);
  });
});
