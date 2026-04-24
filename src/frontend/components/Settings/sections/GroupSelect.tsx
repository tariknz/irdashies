import { useState, useRef, useEffect } from 'react';
import type { TagGroup } from '@irdashies/types';
import { renderDriverIcon } from '@irdashies/utils/driverIcons';
import { CaretDownIcon } from '@phosphor-icons/react';

interface GroupSelectProps {
  value: string;
  onChange: (value: string) => void;
  groups: (
    | TagGroup
    | { id: string; name: string; icon: unknown; color: number }
  )[];
  displayStyle?: 'tag' | 'badge';
  iconWeight?: 'fill' | 'regular';
}

const renderIcon = (
  icon: unknown,
  size: number,
  className?: string,
  colorNum?: number,
  style?: React.CSSProperties,
  fallbackStyle?: React.CSSProperties,
  weight?: string
) =>
  renderDriverIcon(
    icon,
    size,
    className,
    colorNum,
    style,
    fallbackStyle,
    weight
  );

export const GroupSelect = ({
  value,
  onChange,
  groups,
  displayStyle = 'badge',
  iconWeight,
}: GroupSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedGroup = groups.find((g) => g.id === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () =>
        document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="px-2 py-1 bg-slate-700 rounded w-full text-left flex items-center justify-between gap-2 hover:bg-slate-600 transition-colors"
      >
        <div className="flex items-center gap-2 min-w-0 flex-1">
          {selectedGroup && (
            <>
              {displayStyle === 'tag' ? (
                <span
                  style={{
                    display: 'inline-block',
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: selectedGroup.color
                      ? `#${(selectedGroup.color & 0xffffff).toString(16).padStart(6, '0')}`
                      : '#888',
                    flexShrink: 0,
                  }}
                />
              ) : (
                <span
                  className="inline-flex items-center leading-none flex-shrink-0"
                  aria-hidden="true"
                >
                  {selectedGroup.icon &&
                  typeof selectedGroup.icon === 'string' &&
                  selectedGroup.icon.startsWith('data:') ? (
                    <div style={{ width: 16, height: 16 }}>
                      <img
                        src={selectedGroup.icon}
                        alt={selectedGroup.name}
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    renderIcon(
                      selectedGroup.icon,
                      14,
                      undefined,
                      selectedGroup.color,
                      undefined,
                      undefined,
                      iconWeight
                    )
                  )}
                </span>
              )}
              <span className="truncate text-sm">{selectedGroup.name}</span>
            </>
          )}
        </div>
        <CaretDownIcon
          size={16}
          weight="bold"
          className={`flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-700 rounded border border-slate-600 shadow-lg z-10 max-h-60 overflow-y-auto">
          {groups.map((g) => (
            <button
              key={g.id}
              onClick={() => {
                onChange(g.id);
                setIsOpen(false);
              }}
              className={`w-full px-2 py-2 flex items-center gap-2 text-left text-sm transition-colors ${
                g.id === value
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-200 hover:bg-slate-600'
              }`}
            >
              {displayStyle === 'tag' ? (
                <span
                  style={{
                    display: 'inline-block',
                    width: 12,
                    height: 12,
                    borderRadius: 3,
                    background: g.color
                      ? `#${(g.color & 0xffffff).toString(16).padStart(6, '0')}`
                      : '#888',
                    flexShrink: 0,
                  }}
                />
              ) : (
                <span className="inline-flex items-center leading-none flex-shrink-0">
                  {g.icon &&
                  typeof g.icon === 'string' &&
                  g.icon.startsWith('data:') ? (
                    <div style={{ width: 16, height: 16 }}>
                      <img
                        src={g.icon}
                        alt={g.name}
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    renderIcon(
                      g.icon,
                      14,
                      undefined,
                      g.color,
                      undefined,
                      undefined,
                      iconWeight
                    )
                  )}
                </span>
              )}
              <span className="truncate">{g.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

GroupSelect.displayName = 'GroupSelect';
