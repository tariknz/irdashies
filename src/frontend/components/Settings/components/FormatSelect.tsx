import { useEffect, useRef, useState } from 'react';
import { CaretDownIcon } from '@phosphor-icons/react';

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
  const root = useRef<HTMLDivElement>(null);

  // Closes on a click anywhere else and on Escape. Without the first, the
  // panel outlives the click that should have dismissed it; without the
  // second there is no way out for the keyboard.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  return (
    <div ref={root} className="relative flex items-center gap-2">
      <span className="text-xs text-slate-400 shrink-0">{label}</span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${label} rating format`}
        onClick={() => setOpen((wasOpen) => !wasOpen)}
        className="flex items-center gap-2 rounded border border-slate-600 bg-slate-800 px-2 py-1 cursor-pointer hover:border-slate-400"
      >
        {renderOption(value)}
        <CaretDownIcon size={12} className="text-slate-400 shrink-0" />
      </button>

      {open && (
        <div
          role="listbox"
          // Opens under its own control, which now sits inline with the
          // other simulator's rather than at the panel's right edge.
          className="absolute left-0 top-full z-50 mt-1 flex flex-col gap-1 rounded border border-slate-600 bg-slate-900 p-1 shadow-lg"
        >
          {options.map((option) => (
            <button
              key={option}
              type="button"
              role="option"
              aria-selected={option === value}
              onClick={() => {
                onChange(option);
                setOpen(false);
              }}
              className={`flex items-center justify-start rounded border px-2 py-1 cursor-pointer ${
                option === value
                  ? 'border-accent-500 bg-accent-500/10'
                  : 'border-transparent hover:bg-slate-800'
              }`}
            >
              {renderOption(option)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
