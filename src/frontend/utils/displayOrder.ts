/**
 * Merges an existing display order with a complete set of items,
 * inserting any missing items in their default positions.
 *
 * @param allItems - The complete set of all available items in default order
 * @param existingOrder - The current display order (may be undefined for defaults)
 * @returns The merged display order with all items included
 */
export const mergeDisplayOrder = (allItems: string[], existingOrder?: string[]): string[] => {
  if (!existingOrder) return allItems;

  const merged = [...existingOrder];
  const missingIds = allItems.filter(id => !merged.includes(id));

  missingIds.forEach(missingId => {
    const missingIndex = allItems.indexOf(missingId);
    let insertIndex = merged.length;

    for (let i = missingIndex + 1; i < allItems.length; i++) {
      const existingItem = allItems[i];
      const existingItemIndex = merged.indexOf(existingItem);
      if (existingItemIndex !== -1) {
        insertIndex = existingItemIndex;
        break;
      }
    }

    merged.splice(insertIndex, 0, missingId);
  });

  return merged;
};
