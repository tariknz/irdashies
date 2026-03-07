import {
  useState,
  useRef,
  useEffect,
  useMemo,
  memo,
  createElement,
} from 'react';
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
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) searchRef.current?.focus();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen]);

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
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((o) => !o)}
        className="flex items-center gap-1.5 px-2 py-1 bg-slate-600 hover:bg-slate-500 rounded text-sm min-w-[150px]"
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
        <span className="flex-none text-slate-400 text-xs">▾</span>
      </button>

      {isOpen && (
        <div className="absolute z-50 top-full mt-1 left-0 w-80 bg-slate-800 border border-slate-600 rounded shadow-xl">
          <div className="p-2 border-b border-slate-600 space-y-1">
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search icons..."
              className="w-full px-2 py-1 bg-slate-700 rounded text-sm placeholder-slate-400"
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
                }}
                className="text-xs text-red-400 hover:text-red-300"
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
                }}
                title={name}
                className={`flex flex-col items-center gap-0.5 p-1.5 rounded hover:bg-slate-600 transition-colors ${
                  value === name ? 'bg-slate-600 ring-1 ring-sky-500' : ''
                }`}
              >
                <span className="inline-flex items-center justify-center w-5 h-5">
                  {createElement(component, {
                    size: 16,
                    color: colorHex ?? 'currentColor',
                    weight,
                  })}
                </span>
                <span className="text-[8px] text-slate-400 leading-none truncate w-full text-center">
                  {name}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

IconPicker.displayName = 'IconPicker';
export default IconPicker;
