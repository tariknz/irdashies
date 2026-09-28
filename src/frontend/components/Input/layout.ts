import type { InputConfig, LayoutNode } from '@irdashies/types';

export type InputElementId = 'trace' | 'bar' | 'gear' | 'abs' | 'steer';

export const INPUT_ELEMENTS: { id: InputElementId; label: string }[] = [
  { id: 'trace', label: 'Trace' },
  { id: 'bar', label: 'Bar' },
  { id: 'gear', label: 'Gear' },
  { id: 'abs', label: 'ABS' },
  { id: 'steer', label: 'Steer' },
];

type LegacyLayoutConfig = Pick<
  InputConfig,
  'trace' | 'bar' | 'gear' | 'abs' | 'steer' | 'displayOrder'
>;

const isElementId = (id: string): id is InputElementId =>
  INPUT_ELEMENTS.some((e) => e.id === id);

/**
 * Builds a tree that matches the layout from before the layout editor:
 * enabled elements in one row, ordered by displayOrder.
 */
export const buildDefaultInputTree = (
  config: LegacyLayoutConfig
): LayoutNode => {
  // Ring steer already shows gear and speed in its centre.
  const steerIsRing =
    config.steer?.enabled && config.steer.config?.style === 'ring';

  const enabled: Record<InputElementId, boolean> = {
    trace: !!config.trace?.enabled,
    bar: !!config.bar?.enabled,
    gear: !!config.gear?.enabled && !steerIsRing,
    abs: !!config.abs?.enabled,
    steer: !!config.steer?.enabled,
  };

  const order = (config.displayOrder ?? []).filter(isElementId);
  const remaining = INPUT_ELEMENTS.map((e) => e.id).filter(
    (id) => !order.includes(id)
  );
  const ids = [...new Set([...order, ...remaining])].filter(
    (id) => enabled[id]
  );

  const weightOf = (id: InputElementId) => {
    if (id === 'trace') return 4;
    if (id === 'steer' && steerIsRing) return 2;
    return 1;
  };

  return {
    id: 'input-root',
    type: 'split',
    direction: 'row',
    children: ids.map((id) => ({
      id: `input-box-${id}`,
      type: 'box',
      direction: 'col',
      widgets: [id],
      weight: weightOf(id),
    })),
  };
};

const MAX_TREE_DEPTH = 16;

const isLayoutNode = (value: unknown, depth: number): value is LayoutNode => {
  if (depth > MAX_TREE_DEPTH) return false;
  if (!value || typeof value !== 'object') return false;
  const node = value as Record<string, unknown>;
  if (typeof node.id !== 'string') return false;
  if (node.direction !== 'row' && node.direction !== 'col') return false;
  if (
    node.weight !== undefined &&
    (typeof node.weight !== 'number' || !Number.isFinite(node.weight))
  ) {
    return false;
  }
  if (node.type === 'box') {
    return (
      Array.isArray(node.widgets) &&
      node.widgets.every((w) => typeof w === 'string')
    );
  }
  if (node.type === 'split') {
    return (
      Array.isArray(node.children) &&
      node.children.every((c) => isLayoutNode(c, depth + 1))
    );
  }
  return false;
};

/** Checks the whole saved tree, so a damaged one falls back to the default. */
export const hasLayoutTree = (tree: unknown): tree is LayoutNode =>
  isLayoutNode(tree, 0);

export const isEmptyLayoutTree = (tree: LayoutNode): boolean =>
  tree.type === 'split' && tree.children.length === 0;

export const getInputLayoutTree = (
  config: LegacyLayoutConfig & { layoutTree?: LayoutNode }
): LayoutNode =>
  hasLayoutTree(config.layoutTree)
    ? config.layoutTree
    : buildDefaultInputTree(config);
