import { useState, useRef, useId } from 'react';
import { SettingsPopover } from '../components/SettingsPopover';
import type { TagGroup } from '@irdashies/types';
import { renderDriverIcon } from '@irdashies/utils/driverIcons';
import { CaretDownIcon } from '@phosphor-icons/react';

interface GroupSelectProps {
  value: string;
  label?: string;
  onChange: (value: string) => void;
  groups: (
    TagGroup | { id: string; name: string; icon: unknown; color: number }
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
  label = 'Driver group',
  onChange,
  groups,
  displayStyle = 'badge',
  iconWeight,
}: GroupSelectProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionsId = useId();
  const valueId = useId();

  const selectedGroup = groups.find((g) => g.id === value);

  return (
    <div className="relative w-full">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-controls={isOpen ? optionsId : undefined}
        aria-describedby={selectedGroup ? valueId : undefined}
        aria-label={label}
        className="settings-field w-full text-left flex items-center justify-between gap-2 hover:bg-settings-hover"
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
              <span id={valueId} className="truncate text-sm">
                {selectedGroup.name}
              </span>
            </>
          )}
        </div>
        <CaretDownIcon
          size={16}
          weight="bold"
          className={`flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>

      <SettingsPopover
        open={isOpen}
        anchorRef={triggerRef}
        onClose={() => setIsOpen(false)}
        id={optionsId}
        label={`${label} options`}
        matchAnchorWidth
      >
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            aria-pressed={g.id === value}
            onClick={() => {
              onChange(g.id);
              setIsOpen(false);
              triggerRef.current?.focus();
            }}
            className={`w-full px-2 py-2 flex items-center gap-2 text-left text-sm transition-colors ${
              g.id === value
                ? 'bg-accent-600 text-on-accent'
                : 'text-slate-200 hover:bg-settings-hover'
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
                    <img src={g.icon} alt={g.name} className="object-contain" />
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
      </SettingsPopover>
    </div>
  );
};

GroupSelect.displayName = 'GroupSelect';
