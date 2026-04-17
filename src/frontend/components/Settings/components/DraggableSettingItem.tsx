import { ReactNode } from 'react';
import {
  DotsSixVerticalIcon,
  CaretUpIcon,
  CaretDownIcon,
  XCircleIcon,
} from '@phosphor-icons/react';
import { ToggleSwitch } from './ToggleSwitch';
import { SortableItemProps } from '../../SortableList';
import type { ColumnDisplayMode } from '@irdashies/types';

interface DraggableSettingItemProps {
  label: string;
  enabled: boolean;
  displayMode?: ColumnDisplayMode;
  canRotate?: boolean;
  onToggle?: (enabled: boolean) => void;
  onGroupUp?: () => void;
  onGroupDown?: () => void;
  onUngroup?: () => void;
  canGroupUp?: boolean;
  canGroupDown?: boolean;
  isInGroup?: boolean;
  groupColor?: string;
  sortableProps: SortableItemProps;
  children?: ReactNode;
}

export function DraggableSettingItem({
  label,
  enabled,
  onToggle,
  onGroupUp,
  onGroupDown,
  onUngroup,
  canGroupUp = false,
  canGroupDown = false,
  isInGroup = false,
  groupColor,
  sortableProps: { dragHandleProps, itemProps },
  children,
}: DraggableSettingItemProps) {
  return (
    <div
      {...itemProps}
      {...dragHandleProps}
      className="relative px-1 py-1 hover:bg-slate-700/20 rounded-lg group/row transition-colors duration-150 cursor-grab active:cursor-grabbing"
    >
      <div className="flex items-center justify-between group">
        <div className="flex items-center gap-2 flex-1">
          <div className="opacity-60 group-hover/row:opacity-100 transition-opacity p-1 flex-none">
            <DotsSixVerticalIcon size={16} className="text-slate-400" />
          </div>

          <span
            className={[
              'text-sm font-medium select-none',
              enabled ? 'text-slate-200' : 'text-slate-500',
            ].join(' ')}
          >
            {label}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {(canGroupUp || canGroupDown || isInGroup) && (
            <div
              className={[
                'flex items-center gap-1.5 px-2 py-1 bg-slate-800/40 rounded-t-md border-x border-t border-slate-700/50 border-b-2 transition-all duration-200',
                isInGroup
                  ? 'opacity-100'
                  : 'opacity-0 group-hover/row:opacity-100',
              ].join(' ')}
              style={
                isInGroup && groupColor
                  ? { borderBottomColor: groupColor }
                  : { borderBottomColor: 'transparent' }
              }
              onPointerDown={(e) => e.stopPropagation()}
            >
              <span className="text-[10px] font-bold text-slate-500 tracking-wider mr-1 select-none">
                GROUP
              </span>

              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={onGroupUp}
                  disabled={!canGroupUp}
                  className={[
                    'p-0.5 rounded transition-colors',
                    canGroupUp
                      ? 'text-slate-400 hover:bg-slate-700 hover:text-blue-400'
                      : 'text-slate-700 cursor-not-allowed',
                  ].join(' ')}
                  title="Group with item above"
                >
                  <CaretUpIcon size={14} weight="bold" />
                </button>

                <button
                  type="button"
                  onClick={onGroupDown}
                  disabled={!canGroupDown}
                  className={[
                    'p-0.5 rounded transition-colors',
                    canGroupDown
                      ? 'text-slate-400 hover:bg-slate-700 hover:text-blue-400'
                      : 'text-slate-700 cursor-not-allowed',
                  ].join(' ')}
                  title="Group with item below"
                >
                  <CaretDownIcon size={14} weight="bold" />
                </button>
              </div>

              {isInGroup && (
                <button
                  type="button"
                  onClick={onUngroup}
                  className="p-0.5 ml-1 text-slate-500 hover:text-red-400 hover:bg-slate-700 rounded transition-colors"
                  title="Remove from group"
                >
                  <XCircleIcon size={14} weight="fill" />
                </button>
              )}
            </div>
          )}

          {onToggle && (
            <div onPointerDown={(e) => e.stopPropagation()}>
              <ToggleSwitch enabled={enabled} onToggle={onToggle} />
            </div>
          )}
        </div>
      </div>
      {children && (
        <div onPointerDown={(e) => e.stopPropagation()}>{children}</div>
      )}
    </div>
  );
}
