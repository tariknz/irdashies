import { hasLayoutTree, type LayoutNode } from '@irdashies/types';

export {
  hasLayoutTree,
  isEmptyLayoutTree,
  layoutTreeHas,
} from '@irdashies/types';

/**
 * The saved tree when it is a whole, valid one, otherwise the widget's
 * default. Stored trees are untrusted (R8.3), so a damaged one falls back
 * instead of breaking the overlay. The default is built only when needed.
 */
export const resolveLayoutTree = (
  saved: unknown,
  buildDefault: () => LayoutNode
): LayoutNode => (hasLayoutTree(saved) ? saved : buildDefault());

/**
 * The tree with each element kept only where it first appears, reading
 * depth first. A stored tree can hold an element twice (the editor does not
 * produce one, a hand-edited or damaged file can), and drawing it twice
 * would run its work twice. Boxes and splits left empty are dropped; the
 * root stays, empty if need be. Returns the tree itself when nothing repeats.
 */
export const withoutRepeatedElements = (tree: LayoutNode): LayoutNode => {
  const seen = new Set<string>();
  let repeated = false;
  const prune = (node: LayoutNode): LayoutNode | null => {
    if (node.type === 'box') {
      const widgets = node.widgets.filter((widget) => {
        if (seen.has(widget)) {
          repeated = true;
          return false;
        }
        seen.add(widget);
        return true;
      });
      if (widgets.length === 0) return null;
      return widgets.length === node.widgets.length
        ? node
        : { ...node, widgets };
    }
    const children = node.children.flatMap((child) => prune(child) ?? []);
    if (children.length === 0) return null;
    return children.length === node.children.length &&
      children.every((child, i) => child === node.children[i])
      ? node
      : { ...node, children };
  };
  const pruned = prune(tree);
  if (!repeated) return tree;
  return (
    pruned ?? {
      id: tree.id,
      type: 'split',
      direction: tree.direction,
      children: [],
    }
  );
};
