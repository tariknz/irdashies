import { useState, useCallback, useRef, DragEvent, CSSProperties } from 'react';

export function arrayMove<T>(array: T[], from: number, to: number): T[] {
  const result = [...array];
  const [item] = result.splice(from, 1);
  result.splice(to, 0, item);
  return result;
}

interface UseSortableListOptions<T> {
  items: T[];
  onReorder: (newItems: T[]) => void;
  getItemId: (item: T) => string;
}

export interface SortableItemProps {
  isDragging: boolean;
  isOver: boolean;
  dragHandleProps: {
    draggable: true;
    onDragStart: (e: DragEvent<HTMLElement>) => void;
    onDragEnd: () => void;
  };
  itemProps: {
    ref: (el: HTMLElement | null) => void;
    onDragOver: (e: DragEvent<HTMLElement>) => void;
    onDragLeave: () => void;
    onDrop: (e: DragEvent<HTMLElement>) => void;
    style: CSSProperties;
  };
}

export function useSortableList<T>({
  items,
  onReorder,
  getItemId,
}: UseSortableListOptions<T>) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);
  const [previewItems, setPreviewItems] = useState<T[] | null>(null);
  const itemRefs = useRef<Map<string, HTMLElement>>(new Map());
  const draggedIdRef = useRef<string | null>(null);

  const getItemProps = useCallback(
    (item: T): SortableItemProps => {
      const id = getItemId(item);
      const isDragging = draggedId === id;
      const isOver = overId === id && draggedId !== id;

      return {
        isDragging,
        isOver,
        dragHandleProps: {
          draggable: true as const,
          onDragStart: (e: DragEvent<HTMLElement>) => {
            e.dataTransfer.effectAllowed = 'move';
            e.dataTransfer.setData('text/plain', id);
            setDraggedId(id);
            draggedIdRef.current = id;
            setPreviewItems([...items]);
          },
          onDragEnd: () => {
            setDraggedId(null);
            draggedIdRef.current = null;
            setOverId(null);
            setPreviewItems(null);
          },
        },
        itemProps: {
          ref: (el: HTMLElement | null) => {
            if (el) itemRefs.current.set(id, el);
            else itemRefs.current.delete(id);
          },
          onDragOver: (e: DragEvent<HTMLElement>) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            const currentDraggedId = draggedIdRef.current;
            if (currentDraggedId && currentDraggedId !== id) {
              setOverId(id);
              setPreviewItems((prev) => {
                if (!prev) return prev;
                const fromIndex = prev.findIndex(
                  (i) => getItemId(i) === currentDraggedId
                );
                const toIndex = prev.findIndex((i) => getItemId(i) === id);
                if (
                  fromIndex !== -1 &&
                  toIndex !== -1 &&
                  fromIndex !== toIndex
                ) {
                  return arrayMove(prev, fromIndex, toIndex);
                }
                return prev;
              });
            }
          },
          onDragLeave: () => {
            setOverId(null);
          },
          onDrop: (e: DragEvent<HTMLElement>) => {
            e.preventDefault();
            if (previewItems) {
              onReorder(previewItems);
            }
            setDraggedId(null);
            draggedIdRef.current = null;
            setOverId(null);
            setPreviewItems(null);
          },
          style: {
            opacity: isDragging ? 0.5 : 1,
            transition: 'all 150ms ease',
          } as CSSProperties,
        },
      };
    },
    [items, draggedId, overId, previewItems, getItemId, onReorder]
  );

  // Return preview items during drag, otherwise the actual items
  const displayItems = previewItems ?? items;

  return { getItemProps, displayItems };
}
