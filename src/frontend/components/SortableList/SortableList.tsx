import { ReactNode } from 'react';
import { useSortableList, SortableItemProps } from './useSortableList';

interface SortableItem {
  id: string;
}

interface SortableListProps<T extends SortableItem> {
  items: T[];
  onReorder: (newItems: T[]) => void;
  renderItem: (item: T, sortableProps: SortableItemProps) => ReactNode;
  className?: string;
}

export function SortableList<T extends SortableItem>({
  items,
  onReorder,
  renderItem,
  className,
}: SortableListProps<T>) {
  const { getItemProps, displayItems } = useSortableList({
    items,
    onReorder,
    getItemId: (item) => item.id,
  });

  return (
    <div className={className}>
      {displayItems.map((item) => renderItem(item, getItemProps(item)))}
    </div>
  );
}
