import { useId, useRef, useState } from 'react';
import {
  CaretDownIcon,
  SortAscendingIcon,
  ToggleRightIcon,
  TreeViewIcon,
  type Icon,
} from '@phosphor-icons/react';
import { SettingsPopover } from './SettingsPopover';
import {
  MENU_SORT_LABELS,
  MENU_SORT_MODES,
  nextMenuSort,
  type MenuSortMode,
} from '../menuSort';

/**
 * Phosphor has no A-to-Z icon, so the alphabetical order shows the plain
 * ascending sort; the tooltip names it.
 */
const SORT_ICONS: Record<MenuSortMode, Icon> = {
  category: TreeViewIcon,
  alpha: SortAscendingIcon,
  activated: ToggleRightIcon,
};

export interface MenuSortControlProps {
  mode: MenuSortMode;
  onChange: (mode: MenuSortMode) => void;
}

/**
 * Sorts the overlay list. The button shows the current order and steps to
 * the next; the caret beside it lists every order as an icon, named by its
 * tooltip.
 */
export const MenuSortControl = ({ mode, onChange }: MenuSortControlProps) => {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const listId = useId();
  const CurrentIcon = SORT_ICONS[mode];
  const next = nextMenuSort(mode);
  const cycleLabel = `${MENU_SORT_LABELS[mode]}. Click for ${MENU_SORT_LABELS[next].toLowerCase()}`;

  return (
    <div className="flex h-9 shrink-0 items-stretch rounded-md border border-settings-boundary bg-slate-900 text-slate-400">
      <button
        type="button"
        aria-label={`Sort overlays: ${cycleLabel}`}
        title={cycleLabel}
        onClick={() => onChange(next)}
        className="flex w-8 items-center justify-center rounded-l-md cursor-pointer hover:bg-slate-800 hover:text-white"
      >
        <CurrentIcon size={16} />
      </button>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label="Choose how overlays are sorted"
        title="Choose how overlays are sorted"
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="flex w-5 items-center justify-center rounded-r-md border-l border-settings-boundary cursor-pointer hover:bg-slate-800 hover:text-white"
      >
        <CaretDownIcon size={10} />
      </button>

      <SettingsPopover
        open={open}
        anchorRef={trigger}
        onClose={() => setOpen(false)}
        role="listbox"
        label="Sort overlays"
        id={listId}
        minWidth={0}
      >
        {MENU_SORT_MODES.map((option, index) => {
          const OptionIcon = SORT_ICONS[option];
          return (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === mode}
              aria-label={MENU_SORT_LABELS[option]}
              title={MENU_SORT_LABELS[option]}
              tabIndex={option === mode ? 0 : -1}
              onKeyDown={(event) => {
                const step =
                  event.key === 'ArrowDown'
                    ? 1
                    : event.key === 'ArrowUp'
                      ? -1
                      : 0;
                if (step || event.key === 'Home' || event.key === 'End') {
                  event.preventDefault();
                  const target =
                    event.key === 'Home'
                      ? 0
                      : event.key === 'End'
                        ? MENU_SORT_MODES.length - 1
                        : (index + step + MENU_SORT_MODES.length) %
                          MENU_SORT_MODES.length;
                  event.currentTarget.parentElement
                    ?.querySelectorAll<HTMLButtonElement>('[role="option"]')
                    ?.[target]?.focus();
                } else if (event.key === 'Tab') {
                  trigger.current?.focus();
                  setOpen(false);
                }
              }}
              onClick={() => {
                onChange(option);
                setOpen(false);
                trigger.current?.focus();
              }}
              className={`flex h-8 w-8 items-center justify-center rounded border cursor-pointer ${
                option === mode
                  ? 'border-accent-500 bg-accent-500/10 text-accent-200'
                  : 'border-transparent text-slate-300 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <OptionIcon size={16} />
            </button>
          );
        })}
      </SettingsPopover>
    </div>
  );
};
