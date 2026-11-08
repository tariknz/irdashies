import type { LayoutNode } from '@irdashies/types';

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

/** Whether an element appears anywhere in the tree. */
export const layoutTreeHas = (node: LayoutNode, element: string): boolean =>
  node.type === 'box'
    ? node.widgets.includes(element)
    : node.children.some((child) => layoutTreeHas(child, element));
