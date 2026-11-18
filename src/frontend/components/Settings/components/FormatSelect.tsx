import { useId, useRef, useState } from 'react';
import { CaretDownIcon } from '@phosphor-icons/react';
import { SettingsPopover } from './SettingsPopover';

export interface FormatSelectProps<T extends string> {
  /** Shown above the control, e.g. the simulator the formats belong to. */
  label: string;
  value: T;
  options: readonly T[];
  /** Draws one option as it will actually look in a row. */
  renderOption: (option: T) => React.ReactNode;
  onChange: (option: T) => void;
}

/**
 * Picks one format, showing the current choice rather than naming it.
 *
 * These options have no useful names -- `license-color-rating-bw` describes an
 * implementation, not a look -- so the control shows the rendering itself and
 * the list shows the alternatives the same way. That was a flat grid of every
 * option, which worked while there was one set of twelve and stopped working
 * when a second simulator brought its own: two grids side by side is a wall of
 * chips with nothing saying which is in force.
 *
 * Collapsed, it is the selected option and a caret. Open, it is every option
 * with the current one marked.
 */
export const FormatSelect = <T extends string>({
  label,
  value,
  options,
  renderOption,
  onChange,
}: FormatSelectProps<T>) => {
  const [open, setOpen] = useState(false);
  const trigger = useRef<HTMLButtonElement>(null);
  const listId = useId();

  return (
    <div className="relative flex items-center gap-2">
      <span className="text-xs text-slate-400 shrink-0">{label}</span>
      <button
        ref={trigger}
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={`${label} rating format`}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            setOpen(true);
          }
        }}
        className="settings-button"
      >
        {renderOption(value)}
        <CaretDownIcon size={12} className="text-slate-400 shrink-0" />
      </button>

      <SettingsPopover
        open={open}
        anchorRef={trigger}
        onClose={() => setOpen(false)}
        role="listbox"
        label={`${label} rating formats`}
        id={listId}
      >
        {options.map((option, index) => (
          <button
            key={option}
            type="button"
            role="option"
            aria-selected={option === value}
            tabIndex={option === value ? 0 : -1}
            onKeyDown={(event) => {
              const step =
                event.key === 'ArrowDown'
                  ? 1
                  : event.key === 'ArrowUp'
                    ? -1
                    : 0;
              if (step || event.key === 'Home' || event.key === 'End') {
                event.preventDefault();
                const next =
                  event.key === 'Home'
                    ? 0
                    : event.key === 'End'
                      ? options.length - 1
                      : (index + step + options.length) % options.length;
                event.currentTarget.parentElement
                  ?.querySelectorAll<HTMLButtonElement>('[role="option"]')
                  ?.[next]?.focus();
              } else if (event.key === 'Tab') {
                // Continue from the field, rather than from the portal at the
                // end of the settings shell.
                trigger.current?.focus();
                setOpen(false);
              }
            }}
            onClick={() => {
              onChange(option);
              setOpen(false);
              trigger.current?.focus();
            }}
            className={`flex min-h-9 items-center justify-start rounded border px-2 py-1 cursor-pointer ${
              option === value
                ? 'border-accent-500 bg-accent-500/10'
                : 'border-transparent hover:bg-slate-800'
            }`}
          >
            {renderOption(option)}
          </button>
        ))}
      </SettingsPopover>
    </div>
  );
};
