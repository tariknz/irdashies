import { ReactNode } from 'react';
import { DotsSixVerticalIcon } from '@phosphor-icons/react';
import { ToggleSwitch } from './ToggleSwitch';
import { SortableItemProps } from '../../SortableList';

interface DraggableSettingItemProps {
  label: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  sortableProps: SortableItemProps;
  children?: ReactNode;
}

export function DraggableSettingItem({
  label,
  enabled,
  onToggle,
  sortableProps: { dragHandleProps, itemProps },
  children,
}: DraggableSettingItemProps) {
  return (
    <div {...itemProps}>
      <div className="flex items-center justify-between group">
        <div className="flex items-center gap-2 flex-1">
          <div
            {...dragHandleProps}
            className="cursor-grab opacity-60 hover:opacity-100 transition-opacity p-1 hover:bg-slate-600 rounded"
          >
            <DotsSixVerticalIcon size={16} className="text-slate-400" />
          </div>
          <span className="text-sm text-slate-300">{label}</span>
        </div>
        <ToggleSwitch enabled={enabled} onToggle={onToggle} />
      </div>
      {children}
    </div>
  );
}
