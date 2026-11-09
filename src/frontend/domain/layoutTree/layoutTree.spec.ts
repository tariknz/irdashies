import { describe, expect, it } from 'vitest';
import type { LayoutNode } from '@irdashies/types';
import { layoutTreeHas, resolveLayoutTree } from './layoutTree';

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

describe('resolveLayoutTree', () => {
  const fallback = box('default', ['plot']);

  it('keeps a valid saved tree and never builds the default', () => {
    const saved = box('saved', ['corners']);
    let built = 0;
    const buildDefault = () => {
      built += 1;
      return fallback;
    };
    expect(resolveLayoutTree(saved, buildDefault)).toBe(saved);
    expect(built).toBe(0);
  });

  it('falls back to the default for a missing or damaged tree', () => {
    for (const saved of [
      undefined,
      null,
      { id: 'x' },
      { id: 'x', type: 'box', direction: 'col', widgets: [3] },
    ]) {
      expect(resolveLayoutTree(saved, () => fallback)).toBe(fallback);
    }
  });
});
