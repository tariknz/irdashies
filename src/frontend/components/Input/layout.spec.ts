import { describe, it, expect } from 'vitest';
import type { LayoutNode } from '@irdashies/types';
import { getWidgetDefaultConfig } from '@irdashies/types';
import {
  buildDefaultInputTree,
  getInputLayoutTree,
  hasLayoutTree,
  isEmptyLayoutTree,
} from './layout';

const defaults = getWidgetDefaultConfig('input');

const boxes = (tree: LayoutNode) =>
  tree.type === 'split'
    ? tree.children.map((c) => ({
        widgets: c.type === 'box' ? c.widgets : [],
        weight: c.weight,
      }))
    : [];

describe('buildDefaultInputTree', () => {
  it('puts enabled elements in one row in displayOrder', () => {
    const tree = buildDefaultInputTree({
      ...defaults,
      displayOrder: ['steer', 'gear', 'bar', 'trace'],
    });
    expect(tree.type).toBe('split');
    expect(tree.direction).toBe('row');
    expect(boxes(tree).map((b) => b.widgets[0])).toEqual([
      'steer',
      'gear',
      'bar',
      'trace',
    ]);
  });

  it('leaves out disabled elements', () => {
    const tree = buildDefaultInputTree({
      ...defaults,
      bar: { ...defaults.bar, enabled: false },
    });
    expect(boxes(tree).map((b) => b.widgets[0])).not.toContain('bar');
  });

  it('adds enabled elements missing from displayOrder at the end', () => {
    const tree = buildDefaultInputTree({
      ...defaults,
      abs: { enabled: true },
      displayOrder: ['trace', 'bar', 'gear', 'steer'],
    });
    expect(boxes(tree).map((b) => b.widgets[0])).toEqual([
      'trace',
      'bar',
      'gear',
      'steer',
      'abs',
    ]);
  });

  it('keeps the old flex weights', () => {
    const weights = Object.fromEntries(
      boxes(buildDefaultInputTree(defaults)).map((b) => [
        b.widgets[0],
        b.weight,
      ])
    );
    expect(weights).toEqual({ trace: 4, bar: 1, gear: 1, steer: 1 });
  });

  it('drops gear and widens steer when the ring style is on', () => {
    const tree = buildDefaultInputTree({
      ...defaults,
      steer: { enabled: true, config: { style: 'ring', color: 'light' } },
    });
    const result = boxes(tree);
    expect(result.map((b) => b.widgets[0])).not.toContain('gear');
    expect(result.find((b) => b.widgets[0] === 'steer')?.weight).toBe(2);
  });

  it('ignores unknown ids in displayOrder', () => {
    const tree = buildDefaultInputTree({
      ...defaults,
      displayOrder: ['tachometer', 'trace'],
    });
    expect(boxes(tree)[0].widgets).toEqual(['trace']);
  });
});

describe('getInputLayoutTree', () => {
  it('uses the saved tree when there is one', () => {
    const saved: LayoutNode = {
      id: 'root',
      type: 'box',
      direction: 'col',
      widgets: ['gear'],
    };
    expect(getInputLayoutTree({ ...defaults, layoutTree: saved })).toBe(saved);
  });

  it('keeps gear in a saved tree even with ring steer', () => {
    const saved: LayoutNode = {
      id: 'root',
      type: 'box',
      direction: 'row',
      widgets: ['steer', 'gear'],
    };
    const tree = getInputLayoutTree({
      ...defaults,
      steer: { enabled: true, config: { style: 'ring', color: 'light' } },
      layoutTree: saved,
    });
    expect(tree).toBe(saved);
  });

  it('falls back to the enabled flags when the saved tree is invalid', () => {
    const tree = getInputLayoutTree({
      ...defaults,
      layoutTree: {} as LayoutNode,
    });
    expect(tree.id).toBe('input-root');
  });

  it('keeps a saved empty tree, so a layout with nothing in it stays empty', () => {
    const saved: LayoutNode = {
      id: 'root',
      type: 'split',
      direction: 'row',
      children: [],
    };
    expect(getInputLayoutTree({ ...defaults, layoutTree: saved })).toBe(saved);
  });
});

describe('hasLayoutTree', () => {
  const box = (widgets: unknown = ['gear']) => ({
    id: 'b',
    type: 'box',
    direction: 'row',
    widgets,
  });
  const split = (children: unknown[]) => ({
    id: 's',
    type: 'split',
    direction: 'col',
    children,
  });

  it('accepts a valid nested tree', () => {
    expect(hasLayoutTree(split([box(), split([box(['trace'])])]))).toBe(true);
  });

  it.each([
    ['null', null],
    ['a string', 'split'],
    ['a node with no id', { type: 'box', direction: 'row', widgets: [] }],
    ['an unknown type', { ...box(), type: 'grid' }],
    ['a bad direction', { ...box(), direction: 'diagonal' }],
    ['a box without widgets', { ...box(), widgets: undefined }],
    ['a box with non-string widgets', box([1])],
    ['a split without children', { ...split([]), children: undefined }],
    ['a bad node deep in the tree', split([box(), split([{ id: 'x' }])])],
    ['a non-numeric weight', { ...box(), weight: 'wide' }],
  ])('rejects %s', (_label, value) => {
    expect(hasLayoutTree(value)).toBe(false);
  });

  it('rejects a tree nested deeper than any real layout', () => {
    let node: unknown = box();
    for (let i = 0; i < 20; i++) node = split([node]);
    expect(hasLayoutTree(node)).toBe(false);
  });
});

describe('isEmptyLayoutTree', () => {
  it('is true only for a split with no children', () => {
    expect(
      isEmptyLayoutTree({
        id: 's',
        type: 'split',
        direction: 'row',
        children: [],
      })
    ).toBe(true);
    expect(isEmptyLayoutTree(buildDefaultInputTree(defaults))).toBe(false);
  });
});
