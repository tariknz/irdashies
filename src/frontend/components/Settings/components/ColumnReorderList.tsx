import { useState } from 'react';
import { DotsSixVertical } from '@phosphor-icons/react';

interface ColumnReorderListProps {
  columns: string[];
  onChange: (newOrder: string[]) => void;
  getDisplayName: (columnId: string) => string;
}

export const ColumnReorderList = ({
  columns,
  onChange,
  getDisplayName,
}: ColumnReorderListProps) => {
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);

  const handleDragStart = (index: number) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDragLeave = () => {
    setDragOverIndex(null);
  };

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault();
    
    if (draggedIndex === null || draggedIndex === dropIndex) {
      setDraggedIndex(null);
      setDragOverIndex(null);
      return;
    }

    const newOrder = [...columns];
    const [removed] = newOrder.splice(draggedIndex, 1);
    newOrder.splice(dropIndex, 0, removed);

    onChange(newOrder);
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  };

  return (
    <div className="space-y-2">
      {columns.map((columnId, index) => (
        <div
          key={columnId}
          draggable
          onDragStart={() => handleDragStart(index)}
          onDragOver={(e) => handleDragOver(e, index)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, index)}
          onDragEnd={handleDragEnd}
          className={[
            'flex items-center gap-3 p-2 rounded-md cursor-move',
            'bg-slate-700 hover:bg-slate-600 transition-colors',
            draggedIndex === index ? 'opacity-50' : '',
            dragOverIndex === index && draggedIndex !== index
              ? 'border-2 border-blue-500 border-dashed'
              : 'border-2 border-transparent',
          ].join(' ')}
        >
          <DotsSixVertical
            size={20}
            className="text-slate-400 shrink-0"
            weight="bold"
          />
          <span className="text-sm text-slate-200 flex-1">
            {getDisplayName(columnId)}
          </span>
        </div>
      ))}
    </div>
  );
};

