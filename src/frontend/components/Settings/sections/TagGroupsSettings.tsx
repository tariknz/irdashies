import { useState, useRef, useCallback, useMemo } from 'react';
import type {
  DriverTagSettings,
  TagGroup,
  DriverTagEntry,
} from '@irdashies/types';
import { PRESET_DRIVER_TAGS } from '../../../constants/driverTagBadges';
import { renderDriverIcon } from '@irdashies/utils/driverIcons';
import { IconPicker } from '../IconPicker';
import { useDriverTagGlobalSettings } from './useDriverTagGlobalSettings';

type IconMode = 'name' | 'image';

interface EntryDraft {
  uiKey: string;
  id: string;
  name: string;
  label: string;
  groupId: string;
}

const toEntryDraft = (e: DriverTagEntry, key: string): EntryDraft => ({
  uiKey: key,
  id: e.id ?? '',
  name: e.name ?? '',
  label: e.label ?? '',
  groupId: e.groupId,
});

export const TagGroupsSettings = () => {
  const { tagSettings, loading, saveTagSettings } =
    useDriverTagGlobalSettings();

  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [editingGroupColor, setEditingGroupColor] = useState<
    number | undefined
  >(undefined);
  const [editingGroupIcon, setEditingGroupIcon] = useState<string | undefined>(
    undefined
  );
  const [editingGroupIconMode, setEditingGroupIconMode] =
    useState<IconMode>('name');
  const [pendingNewGroup, setPendingNewGroup] = useState<{ id: string } | null>(
    null
  );
  const [entryDrafts, setEntryDrafts] = useState<EntryDraft[]>([]);
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const settings: DriverTagSettings = tagSettings;

  const updateDashboard = useCallback(
    (next: DriverTagSettings) => {
      saveTagSettings(next);
    },
    [saveTagSettings]
  );

  const updateGroup = useCallback(
    (id: string, patch: Partial<TagGroup>) => {
      updateDashboard({
        ...settings,
        groups: settings.groups.map((g) =>
          g.id === id ? { ...g, ...patch } : g
        ),
      });
    },
    [settings, updateDashboard]
  );

  const removeGroup = useCallback(
    (id: string) => {
      updateDashboard({
        ...settings,
        groups: settings.groups.filter((g) => g.id !== id),
        entries: (settings.entries ?? []).filter((e) => e.groupId !== id),
      });
    },
    [settings, updateDashboard]
  );

  const addGroup = useCallback(() => {
    const id = `custom-${Date.now()}`;
    setPendingNewGroup({ id });
    setEditingGroupId(id);
    setEditingGroupName('');
    setEditingGroupColor(0xff0000);
    setEditingGroupIcon(undefined);
    setEditingGroupIconMode('name');
  }, []);

  // Entry management
  const committedEntries = useMemo(
    () => settings.entries ?? [],
    [settings.entries]
  );

  const syncedDrafts = useMemo(() => {
    // New (uncommitted) drafts appear first, in insertion order
    const newDrafts = entryDrafts.filter((d) => d.uiKey.startsWith('new-'));
    // Committed entries follow in their saved order; use draft value if being edited
    const committed = committedEntries.map((entry, idx) => {
      const key = entry.id
        ? `id-${entry.id}`
        : entry.name
          ? `name-${entry.name}`
          : `group-${entry.groupId}-${idx}`;
      return (
        entryDrafts.find((d) => d.uiKey === key) ?? toEntryDraft(entry, key)
      );
    });
    return [...newDrafts, ...committed];
  }, [committedEntries, entryDrafts]);

  const addEntry = useCallback(() => {
    const key = `new-${Date.now()}`;
    const firstGroup =
      PRESET_DRIVER_TAGS[0]?.id ?? settings.groups[0]?.id ?? '';
    setEntryDrafts((prev) => [
      ...prev,
      { uiKey: key, id: '', name: '', label: '', groupId: firstGroup },
    ]);
  }, [settings.groups]);

  const updateEntryDraft = useCallback(
    (key: string, field: 'id' | 'name' | 'label', value: string) => {
      setEntryDrafts((prev) => {
        const exists = prev.some((d) => d.uiKey === key);
        if (exists) {
          return prev.map((d) =>
            d.uiKey === key ? { ...d, [field]: value } : d
          );
        }
        // Promote committed entry to an editable draft on first edit
        const source = syncedDrafts.find((d) => d.uiKey === key);
        if (!source) return prev;
        return [...prev, { ...source, [field]: value }];
      });
    },
    [syncedDrafts]
  );

  const commitEntry = useCallback(
    (key: string) => {
      const draft = syncedDrafts.find((d) => d.uiKey === key);
      if (!draft) return;
      if (!draft.id.trim() && !draft.name.trim()) {
        // Remove empty entry
        setEntryDrafts((prev) => prev.filter((d) => d.uiKey !== key));
        updateDashboard({
          ...settings,
          entries: committedEntries.filter(
            (e) =>
              !(
                (e.id === undefined || e.id === '') &&
                (e.name === undefined || e.name === '')
              )
          ),
        });
        return;
      }
      const entry: DriverTagEntry = {
        groupId: draft.groupId,
        ...(draft.id.trim() ? { id: draft.id.trim() } : {}),
        ...(draft.name.trim() ? { name: draft.name.trim() } : {}),
        ...(draft.label.trim() ? { label: draft.label.trim() } : {}),
      };
      // Replace existing entry by uiKey match or append
      const existing = committedEntries.find((e) => {
        const eKey = e.id
          ? `id-${e.id}`
          : e.name
            ? `name-${e.name}`
            : undefined;
        return eKey === key;
      });
      let newEntries: DriverTagEntry[];
      if (existing) {
        newEntries = committedEntries.map((e) => (e === existing ? entry : e));
      } else {
        newEntries = [entry, ...committedEntries];
      }
      updateDashboard({ ...settings, entries: newEntries });
      setEntryDrafts((prev) => prev.filter((d) => d.uiKey !== key));
    },
    [syncedDrafts, committedEntries, settings, updateDashboard]
  );

  const updateEntryGroup = useCallback(
    (key: string, groupId: string) => {
      setEntryDrafts((prev) =>
        prev.map((d) => (d.uiKey === key ? { ...d, groupId } : d))
      );
      // Also persist the group change immediately
      const draft = syncedDrafts.find((d) => d.uiKey === key);
      if (!draft) return;
      const existing = committedEntries.find((e) => {
        const eKey = e.id
          ? `id-${e.id}`
          : e.name
            ? `name-${e.name}`
            : undefined;
        return eKey === key;
      });
      if (existing) {
        updateDashboard({
          ...settings,
          entries: committedEntries.map((e) =>
            e === existing ? { ...e, groupId } : e
          ),
        });
      }
    },
    [syncedDrafts, committedEntries, settings, updateDashboard]
  );

  const removeEntry = useCallback(
    (key: string) => {
      setEntryDrafts((prev) => prev.filter((d) => d.uiKey !== key));
      const existing = committedEntries.find((e) => {
        const eKey = e.id
          ? `id-${e.id}`
          : e.name
            ? `name-${e.name}`
            : undefined;
        return eKey === key;
      });
      if (existing) {
        updateDashboard({
          ...settings,
          entries: committedEntries.filter((e) => e !== existing),
        });
      }
    },
    [committedEntries, settings, updateDashboard]
  );

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

  const filteredEntries = useMemo(
    () =>
      syncedDrafts.filter((r) =>
        activeGroupFilter ? r.groupId === activeGroupFilter : true
      ),
    [syncedDrafts, activeGroupFilter]
  );

  if (loading) {
    return <div className="p-4 text-slate-400">Loading...</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 bg-slate-700 rounded">
        <h2 className="text-xl mb-2">Driver Tags</h2>
        <p className="text-slate-400">
          Create color-coded driver tag groups and assign drivers by iRacing ID
          (preferred) or iRacing Name.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4 mt-4">
        {/* Display style */}
        <div className="flex items-center gap-3">
          <label className="text-sm text-slate-300">Display style:</label>
          <select
            value={
              settings.display?.displayStyle === 'tag'
                ? 'tag'
                : settings.display?.iconWeight === 'fill'
                  ? 'badge-fill'
                  : 'badge-regular'
            }
            onChange={(e) => {
              const val = e.target.value;
              if (val === 'tag') {
                updateDashboard({
                  ...settings,
                  display: {
                    ...(settings.display ?? { enabled: false, widthPx: 6 }),
                    displayStyle: 'tag',
                  },
                });
              } else {
                updateDashboard({
                  ...settings,
                  display: {
                    ...(settings.display ?? { enabled: false, widthPx: 6 }),
                    displayStyle: 'badge',
                    iconWeight: val === 'badge-fill' ? 'fill' : 'regular',
                  },
                });
              }
            }}
            className="px-2 py-1 bg-slate-700 rounded text-sm"
          >
            <option value="badge-fill">Badges (icons, filled)</option>
            <option value="badge-regular">Badges (icons, outlined)</option>
            <option value="tag">Tags (colored pills)</option>
          </select>
        </div>

        {/* Preset tag preview */}
        <div className="flex flex-wrap items-center gap-3">
          {PRESET_DRIVER_TAGS.map((preset) => (
            <div
              key={preset.id}
              className="inline-flex items-center gap-2 px-2 py-1 rounded bg-slate-800 text-sm text-slate-100"
            >
              {settings.display?.displayStyle === 'tag' ? (
                <span
                  style={{
                    display: 'inline-block',
                    width: 16,
                    height: 16,
                    borderRadius: 6,
                    background: `#${(preset.color & 0xffffff).toString(16).padStart(6, '0')}`,
                  }}
                />
              ) : (
                <span
                  className="inline-flex items-center justify-center w-8 h-8 text-xl leading-none"
                  aria-hidden="true"
                >
                  {renderIcon(
                    preset.icon,
                    24,
                    undefined,
                    preset.color,
                    undefined,
                    undefined,
                    settings.display?.iconWeight
                  )}
                </span>
              )}
              <span className="whitespace-nowrap">{preset.name}</span>
            </div>
          ))}
        </div>

        {/* Groups section */}
        <div className="flex items-center justify-between">
          <h3 className="text-lg">Groups</h3>
          <button onClick={addGroup} className="px-3 py-1 bg-blue-600 rounded">
            Add Group
          </button>
        </div>

        {((settings.groups ?? []).length > 0 || pendingNewGroup) && (
          <div className="mt-2">
            <div className="text-sm text-slate-300 mb-2">Custom groups:</div>
            <div className="flex flex-col gap-2">
              {[
                ...(settings.groups ?? []),
                ...(pendingNewGroup
                  ? [{ id: pendingNewGroup.id, name: '', color: 0xff0000 }]
                  : []),
              ].map((g) => (
                <div
                  key={g.id}
                  className="inline-flex w-auto self-start items-center gap-3 px-2 py-1 rounded bg-slate-700 text-sm text-slate-100"
                >
                  {editingGroupId === g.id ? (
                    <div className="flex items-center gap-2">
                      <input
                        value={editingGroupName}
                        onChange={(e) => setEditingGroupName(e.target.value)}
                        placeholder="Group name"
                        className="px-2 py-1 bg-slate-600 rounded text-sm"
                      />
                      {settings.display?.displayStyle === 'tag' ? (
                        <>
                          <input
                            type="color"
                            value={
                              editingGroupColor != null
                                ? `#${(editingGroupColor & 0xffffff).toString(16).padStart(6, '0')}`
                                : '#ff0000'
                            }
                            onChange={(e) =>
                              setEditingGroupColor(
                                parseInt(e.target.value.replace('#', ''), 16)
                              )
                            }
                            className="w-10 h-6 p-0 border-0 rounded cursor-pointer"
                          />
                          <span
                            style={{
                              display: 'inline-block',
                              width: 20,
                              height: 20,
                              borderRadius: 6,
                              background:
                                editingGroupColor != null
                                  ? `#${(editingGroupColor & 0xffffff).toString(16).padStart(6, '0')}`
                                  : '#ff0000',
                            }}
                          />
                        </>
                      ) : (
                        <>
                          <div className="flex gap-1">
                            <button
                              onClick={() => {
                                setEditingGroupIconMode('name');
                                if (
                                  typeof editingGroupIcon === 'string' &&
                                  editingGroupIcon.startsWith('data:')
                                )
                                  setEditingGroupIcon(undefined);
                              }}
                              className={`px-2 py-0.5 rounded text-xs ${editingGroupIconMode === 'name' ? 'bg-sky-600 text-white' : 'bg-slate-600 text-slate-300'}`}
                            >
                              Icon
                            </button>
                            <button
                              onClick={() => {
                                setEditingGroupIconMode('image');
                                if (
                                  typeof editingGroupIcon === 'string' &&
                                  !editingGroupIcon.startsWith('data:')
                                )
                                  setEditingGroupIcon(undefined);
                              }}
                              className={`px-2 py-0.5 rounded text-xs ${editingGroupIconMode === 'image' ? 'bg-sky-600 text-white' : 'bg-slate-600 text-slate-300'}`}
                            >
                              Custom image
                            </button>
                          </div>
                          {editingGroupIconMode === 'name' ? (
                            <>
                              <IconPicker
                                value={
                                  typeof editingGroupIcon === 'string' &&
                                  !editingGroupIcon.startsWith('data:')
                                    ? editingGroupIcon || undefined
                                    : undefined
                                }
                                onChange={(iconName) =>
                                  setEditingGroupIcon(iconName)
                                }
                                color={editingGroupColor}
                                weight={settings.display?.iconWeight}
                              />
                              <input
                                type="color"
                                value={`#${((editingGroupColor ?? 0xffffff) & 0xffffff).toString(16).padStart(6, '0')}`}
                                onChange={(e) =>
                                  setEditingGroupColor(
                                    parseInt(
                                      e.target.value.replace('#', ''),
                                      16
                                    )
                                  )
                                }
                                className="w-10 h-6 p-0 border-0 rounded cursor-pointer"
                              />
                            </>
                          ) : (
                            <>
                              <input
                                ref={(el) => {
                                  fileInputRef.current = el;
                                }}
                                type="file"
                                accept="image/*"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (!f) return;
                                  const reader = new FileReader();
                                  reader.onload = () =>
                                    setEditingGroupIcon(
                                      reader.result as string
                                    );
                                  reader.readAsDataURL(f);
                                }}
                                className="hidden"
                              />
                              <button
                                onClick={() => fileInputRef.current?.click()}
                                className="px-2 py-1 bg-slate-600 rounded text-xs"
                              >
                                Add custom badge
                              </button>
                              {typeof editingGroupIcon === 'string' &&
                                editingGroupIcon.startsWith('data:') && (
                                  <img
                                    src={editingGroupIcon}
                                    alt="preview"
                                    className="w-8 h-8 object-contain rounded"
                                  />
                                )}
                            </>
                          )}
                        </>
                      )}
                      <button
                        disabled={!editingGroupName.trim()}
                        onClick={() => {
                          const iconToSave =
                            editingGroupIconMode === 'image'
                              ? typeof editingGroupIcon === 'string' &&
                                editingGroupIcon.startsWith('data:')
                                ? editingGroupIcon
                                : undefined
                              : typeof editingGroupIcon === 'string' &&
                                  editingGroupIcon.trim()
                                ? editingGroupIcon.trim()
                                : undefined;
                          if (pendingNewGroup?.id === g.id) {
                            updateDashboard({
                              ...settings,
                              groups: [
                                ...(settings.groups ?? []),
                                {
                                  id: g.id,
                                  name: editingGroupName,
                                  color: editingGroupColor ?? 0xff0000,
                                  icon: iconToSave,
                                },
                              ],
                            });
                            setPendingNewGroup(null);
                          } else {
                            updateGroup(g.id, {
                              name: editingGroupName,
                              icon: iconToSave,
                              color: editingGroupColor,
                            });
                          }
                          setEditingGroupId(null);
                          setEditingGroupIcon(undefined);
                          setEditingGroupColor(undefined);
                        }}
                        className="px-2 py-1 bg-sky-600 rounded text-xs disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => {
                          if (pendingNewGroup?.id === g.id) {
                            setPendingNewGroup(null);
                          }
                          setEditingGroupId(null);
                          setEditingGroupIcon(undefined);
                          setEditingGroupColor(undefined);
                        }}
                        className="px-2 py-1 bg-slate-600 rounded text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      {settings.display?.displayStyle === 'tag' ? (
                        <span
                          style={{
                            display: 'inline-block',
                            width: 16,
                            height: 16,
                            borderRadius: 6,
                            background: g.color
                              ? `#${(g.color & 0xffffff).toString(16).padStart(6, '0')}`
                              : '#888',
                          }}
                        />
                      ) : g.icon &&
                        typeof g.icon === 'string' &&
                        g.icon.startsWith('data:') ? (
                        <img
                          src={g.icon}
                          alt={g.name}
                          className="w-7 h-7 object-contain"
                        />
                      ) : (
                        <span
                          className="inline-flex items-center justify-center w-8 h-8 text-xl leading-none"
                          aria-hidden="true"
                        >
                          {renderIcon(
                            g.icon,
                            24,
                            undefined,
                            g.color,
                            undefined,
                            undefined,
                            settings.display?.iconWeight
                          )}
                        </span>
                      )}
                      <span className="whitespace-nowrap">{g.name}</span>
                      <div className="ml-auto flex-none inline-flex items-center gap-2">
                        <button
                          onClick={() => {
                            setEditingGroupId(g.id);
                            setEditingGroupName(g.name);
                            setEditingGroupIcon(g.icon);
                            setEditingGroupColor(g.color);
                            setEditingGroupIconMode(
                              typeof g.icon === 'string' &&
                                g.icon.startsWith('data:')
                                ? 'image'
                                : 'name'
                            );
                          }}
                          className="flex-none w-auto px-2 py-0.5 text-xs text-slate-300"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => removeGroup(g.id)}
                          className="flex-none w-auto px-2 py-0.5 text-xs text-red-400"
                        >
                          Delete
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Driver assignments */}
        <div className="pt-4">
          <h3 className="text-lg">Driver Assignments</h3>
          <p className="text-sm text-slate-400">
            Assign drivers by iRacing ID (preferred) and/or display name. Each
            driver may belong to one group.
          </p>

          <div className="space-y-2 mt-2">
            {/* Group filter buttons */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <button
                onClick={() => setActiveGroupFilter(null)}
                aria-pressed={activeGroupFilter === null}
                className={`px-3 py-1 rounded font-medium transition-colors shadow-sm ${activeGroupFilter === null ? 'bg-sky-500 text-white ring-2 ring-sky-300' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}
              >
                All
              </button>
              {PRESET_DRIVER_TAGS.map((g) => {
                const override = settings.presetOverrides?.[g.id];
                const colorNum = override?.color ?? g.color;
                const icon = override?.icon ?? g.icon;
                const name = override?.name ?? g.name;
                return (
                  <button
                    key={g.id}
                    onClick={() =>
                      setActiveGroupFilter(
                        activeGroupFilter === g.id ? null : g.id
                      )
                    }
                    aria-pressed={activeGroupFilter === g.id}
                    title={name}
                    aria-label={name}
                    className={`px-3 py-1 rounded inline-flex items-center gap-1.5 transition-colors shadow-sm text-sm ${activeGroupFilter === g.id ? 'bg-sky-500 text-white ring-2 ring-sky-300' : 'bg-slate-700 text-slate-200 border border-slate-600 hover:bg-slate-600'}`}
                  >
                    {settings.display?.displayStyle === 'tag' ? (
                      <span
                        style={{
                          display: 'inline-block',
                          width: 10,
                          height: 10,
                          borderRadius: 3,
                          background: `#${(colorNum & 0xffffff).toString(16).padStart(6, '0')}`,
                        }}
                      />
                    ) : (
                      <span
                        className="inline-flex items-center leading-none"
                        aria-hidden="true"
                      >
                        {renderIcon(
                          icon,
                          14,
                          undefined,
                          colorNum,
                          undefined,
                          undefined,
                          settings.display?.iconWeight
                        )}
                      </span>
                    )}
                    {name}
                  </button>
                );
              })}
              {(settings.groups ?? []).map((g) => (
                <button
                  key={g.id}
                  onClick={() =>
                    setActiveGroupFilter(
                      activeGroupFilter === g.id ? null : g.id
                    )
                  }
                  aria-pressed={activeGroupFilter === g.id}
                  title={g.name}
                  aria-label={g.name}
                  className={`px-3 py-1 rounded inline-flex items-center gap-1.5 transition-colors shadow-sm text-sm ${activeGroupFilter === g.id ? 'bg-sky-500 text-white ring-2 ring-sky-300' : 'bg-slate-700 text-slate-200 border border-slate-600 hover:bg-slate-600'}`}
                >
                  {settings.display?.displayStyle === 'tag' ? (
                    <span
                      style={{
                        display: 'inline-block',
                        width: 10,
                        height: 10,
                        borderRadius: 3,
                        background: g.color
                          ? `#${(g.color & 0xffffff).toString(16).padStart(6, '0')}`
                          : '#888',
                      }}
                    />
                  ) : (
                    <span
                      className="inline-flex items-center leading-none"
                      aria-hidden="true"
                    >
                      {renderIcon(
                        g.icon,
                        14,
                        undefined,
                        g.color,
                        undefined,
                        undefined,
                        settings.display?.iconWeight
                      )}
                    </span>
                  )}
                  {g.name}
                </button>
              ))}
            </div>

            <div className="mb-3">
              <button
                onClick={addEntry}
                className="px-3 py-1 bg-green-600 rounded"
              >
                Add Driver
              </button>
            </div>

            {filteredEntries.length > 0 && (
              <div className="grid grid-cols-[5rem_9rem_9rem_1fr_auto] gap-2 items-center text-xs text-slate-400 pb-1">
                <span>iRacing ID</span>
                <span>iRacing Name</span>
                <span>Driver Label</span>
                <span>Group</span>
                <span />
              </div>
            )}

            {filteredEntries.map((row) => (
              <div
                key={row.uiKey}
                className="grid grid-cols-[5rem_9rem_9rem_1fr_auto] gap-2 items-center"
              >
                <input
                  ref={(el) => {
                    inputRefs.current[`${row.uiKey}-id`] = el;
                  }}
                  value={row.id}
                  onChange={(e) =>
                    updateEntryDraft(row.uiKey, 'id', e.target.value)
                  }
                  onBlur={(e) => {
                    if (
                      e.relatedTarget ===
                        inputRefs.current[`${row.uiKey}-name`] ||
                      e.relatedTarget ===
                        inputRefs.current[`${row.uiKey}-label`]
                    )
                      return;
                    commitEntry(row.uiKey);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')
                      (e.currentTarget as HTMLInputElement).blur();
                  }}
                  placeholder="e.g. 123456"
                  className="px-2 py-1 bg-slate-700 rounded w-full"
                />
                <input
                  ref={(el) => {
                    inputRefs.current[`${row.uiKey}-name`] = el;
                  }}
                  value={row.name}
                  onChange={(e) =>
                    updateEntryDraft(row.uiKey, 'name', e.target.value)
                  }
                  onBlur={() => commitEntry(row.uiKey)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')
                      (e.currentTarget as HTMLInputElement).blur();
                  }}
                  placeholder="iRacing Full Name"
                  className="px-2 py-1 bg-slate-700 rounded w-full"
                />
                <input
                  ref={(el) => {
                    inputRefs.current[`${row.uiKey}-label`] = el;
                  }}
                  value={row.label}
                  onChange={(e) =>
                    updateEntryDraft(row.uiKey, 'label', e.target.value)
                  }
                  onBlur={() => commitEntry(row.uiKey)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')
                      (e.currentTarget as HTMLInputElement).blur();
                  }}
                  placeholder="Badge label"
                  className="px-2 py-1 bg-slate-700 rounded w-full"
                />
                <select
                  value={row.groupId}
                  onChange={(e) => updateEntryGroup(row.uiKey, e.target.value)}
                  className="px-2 py-1 bg-slate-700 rounded w-full"
                >
                  {PRESET_DRIVER_TAGS.map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                  {(settings.groups ?? []).map((g) => (
                    <option key={g.id} value={g.id}>
                      {g.name}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => removeEntry(row.uiKey)}
                  className="px-2 py-1 bg-red-600 rounded"
                >
                  Remove
                </button>
              </div>
            ))}

            <p className="mt-1 text-xs italic text-white/40">
              * iRacing ID is matched first when provided. Display name is used
              as a fallback if no ID is set or no match is found.
            </p>
          </div>
        </div>

        {/* Name display settings */}
        <div className="pt-4">
          <h3 className="text-lg">Name Display</h3>
          <p className="text-sm text-slate-400">
            When a Driver Label is provided, choose what is displayed for the
            Driver Name in the Standings and Relative overlays.
          </p>

          <div className="space-y-3 mt-3">
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Display mode</span>
              <select
                value={settings.display?.nameDisplay ?? 'both'}
                onChange={(e) =>
                  updateDashboard({
                    ...settings,
                    display: {
                      ...(settings.display ?? { enabled: false, widthPx: 6 }),
                      nameDisplay: e.target.value as 'both' | 'label' | 'name',
                    },
                  })
                }
                className="px-2 py-1 bg-slate-700 rounded text-sm"
              >
                <option value="both">Both (Alternate)</option>
                <option value="label">Label only</option>
                <option value="name">Name only</option>
              </select>
            </div>

            {(settings.display?.nameDisplay ?? 'both') === 'both' && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">
                  Alternate Frequency
                </span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="2"
                    max="60"
                    value={settings.display?.alternateFrequency ?? 5}
                    onChange={(e) =>
                      updateDashboard({
                        ...settings,
                        display: {
                          ...(settings.display ?? {
                            enabled: false,
                            widthPx: 6,
                          }),
                          alternateFrequency: parseInt(e.target.value),
                        },
                      })
                    }
                    className="h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                  />
                  <span className="text-xs text-slate-400 w-8">
                    {settings.display?.alternateFrequency ?? 5}s
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TagGroupsSettings;
