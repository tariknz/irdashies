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
