import { ReactNode } from 'react';
import { DotsSixVerticalIcon } from '@phosphor-icons/react';
import { ToggleSwitch } from './ToggleSwitch';
import { ReorderControls } from './ReorderControls';
import { SortableItemProps } from '../../SortableList';

interface DraggableSettingItemProps {
  label: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  sortableProps: SortableItemProps;
  showToggle?: boolean;
  children?: ReactNode;
}

export function DraggableSettingItem({
  label,
  enabled,
  onToggle,
  sortableProps: {
    dragHandleProps,
    itemProps,
    onMoveUp,
    onMoveDown,
    position,
    total,
  },
  showToggle = true,
  children,
}: DraggableSettingItemProps) {
  return (
    <div {...itemProps} className="border-b border-slate-700 px-1 pb-3">
      <div className="group flex min-h-9 items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 flex-1">
          <div
            {...dragHandleProps}
            className="cursor-grab opacity-60 hover:opacity-100 transition-opacity p-1 hover:bg-settings-hover rounded"
          >
            <DotsSixVerticalIcon size={16} className="text-slate-400" />
          </div>
          <span className="text-sm font-normal text-slate-200">{label}</span>
        </div>
        <ReorderControls
          label={label}
          position={position}
          total={total}
          onMoveUp={onMoveUp}
          onMoveDown={onMoveDown}
        />
        {showToggle && (
          <ToggleSwitch
            enabled={enabled}
            onToggle={onToggle}
            ariaLabel={label}
          />
        )}
      </div>
      {children}
    </div>
  );
}
