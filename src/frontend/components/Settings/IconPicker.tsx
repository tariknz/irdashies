import { CaretDownIcon } from '@phosphor-icons/react';
import { SettingsPopover } from './components/SettingsPopover';
import { useState, useRef, useMemo, memo, createElement, useId } from 'react';
import { PHOSPHOR_ICON_ENTRIES } from '@irdashies/utils/phosphorIconMap';

interface IconPickerProps {
  value?: string;
  onChange: (iconName: string | undefined) => void;
  color?: number;
  weight?: string;
}

export const IconPicker = memo(function IconPicker({
  value,
  onChange,
  color,
  weight,
}: IconPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();

  const colorHex =
    color != null
      ? `#${(color & 0xffffff).toString(16).padStart(6, '0')}`
      : undefined;

  const filteredIcons = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return PHOSPHOR_ICON_ENTRIES.slice(0, 120);
    return PHOSPHOR_ICON_ENTRIES.filter(
      (e) =>
        e.name.toLowerCase().includes(q) ||
        e.tags.some((t) =>
          t
            .replace(/^\*|\*$/g, '')
            .toLowerCase()
            .includes(q)
        )
    ).slice(0, 240);
  }, [search]);

  const selectedEntry = value
    ? PHOSPHOR_ICON_ENTRIES.find((e) => e.name === value)
    : undefined;

  return (
    <div className="relative">
      <button
        ref={triggerRef}
        aria-label="Driver group icon"
        aria-expanded={isOpen}
        aria-controls={isOpen ? panelId : undefined}
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="settings-button min-w-[150px]"
      >
        <span className="flex-none inline-flex items-center justify-center w-5 h-5">
          {selectedEntry
            ? createElement(selectedEntry.component, {
                size: 16,
                color: colorHex ?? 'currentColor',
                weight,
              })
            : null}
        </span>
        <span className="flex-1 text-xs truncate text-left">
          {value ? (
            value
          ) : (
            <span className="text-slate-400">Select an Icon</span>
          )}
        </span>
        <CaretDownIcon size={16} className="shrink-0 text-slate-400" />
      </button>

      <SettingsPopover
        open={isOpen}
        anchorRef={triggerRef}
        initialFocusRef={searchRef}
        id={panelId}
        label="Driver group icons"
        onClose={() => {
          setIsOpen(false);
          setSearch('');
        }}
      >
        <div className="w-72 max-w-full">
          <div className="p-2 border-b border-settings-boundary space-y-1">
            <input
              ref={searchRef}
              aria-label="Search driver group icons"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search icons..."
              className="settings-field w-full placeholder-slate-400"
            />
            <p className="text-xs text-slate-500">
              {search.trim()
                ? `${filteredIcons.length} result${filteredIcons.length !== 1 ? 's' : ''}`
                : `Showing first 120 of ${PHOSPHOR_ICON_ENTRIES.length} — search to filter`}
            </p>
          </div>

          {value && (
            <div className="px-2 py-1 border-b border-slate-700">
              <button
                type="button"
                onClick={() => {
                  onChange(undefined);
                  setIsOpen(false);
                  setSearch('');
                  triggerRef.current?.focus();
                }}
                className="settings-button-danger"
              >
                Clear selection
              </button>
            </div>
          )}

          <div className="grid grid-cols-6 gap-0.5 p-2 overflow-y-auto max-h-56">
            {filteredIcons.map(({ name, component }) => (
              <button
                key={name}
                type="button"
                onClick={() => {
                  onChange(name);
                  setIsOpen(false);
                  setSearch('');
                  triggerRef.current?.focus();
                }}
                aria-label={name}
                aria-pressed={value === name}
                title={name}
                className={`flex flex-col items-center gap-0.5 p-1.5 rounded hover:bg-settings-hover transition-colors ${
                  value === name
                    ? 'bg-settings-control ring-1 ring-accent-500'
                    : ''
                }`}
              >
                <span className="inline-flex items-center justify-center w-5 h-5">
                  {createElement(component, {
                    size: 16,
                    color: colorHex ?? 'currentColor',
                    weight,
                  })}
                </span>
                <span className="text-[10px] text-slate-400 leading-none truncate w-full text-center">
                  {name}
                </span>
              </button>
            ))}
          </div>
        </div>
      </SettingsPopover>
    </div>
  );
});

IconPicker.displayName = 'IconPicker';
export default IconPicker;
