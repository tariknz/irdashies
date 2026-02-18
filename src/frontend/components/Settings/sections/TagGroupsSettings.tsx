import { useState, useEffect, useRef } from 'react';
// colorNumToHex is handled by the shared renderer
import { useDashboard } from '@irdashies/context';
import type { DriverTagSettings, DriverTagEntry } from '@irdashies/types';
import { PRESET_DRIVER_TAGS } from '../../../constants/driverTagBadges';
import { renderDriverIcon } from '../../../utils/driverIcons';
import { IconPicker } from '../IconPicker';

// Preset badge groups are provided by code; colors and dynamic groups removed.

interface EntryRow {
  uiKey: string;
  id: string;
  name: string;
  groupId: string;
}

const loadEntryRows = (existing: DriverTagSettings | undefined): EntryRow[] => {
  if (!existing) return [];

  // Prefer entries over legacy mapping
  if (existing.entries && existing.entries.length > 0) {
    return existing.entries.map((e, i) => ({
      uiKey: `entry-${i}`,
      id: e.id ?? '',
      name: e.name ?? '',
      groupId: e.groupId,
    }));
  }

  // Migrate legacy mapping: numeric keys → id field, non-numeric → name field
  return Object.entries(existing.mapping ?? {})
    .filter(([k]) => !k.startsWith('__new__:'))
    .map(([k, v]) => ({
      uiKey: `entry-migrated-${k}`,
      id: /^\d+$/.test(k) ? k : '',
      name: /^\d+$/.test(k) ? '' : k,
      groupId: v,
    }));
};

export const TagGroupsSettings = () => {
  const { currentDashboard, onDashboardUpdated } = useDashboard();

  const existing = currentDashboard?.generalSettings?.driverTagSettings;
  const [settings, setSettings] = useState<DriverTagSettings>(
    existing ?? {
      groups: [],
      mapping: {},
      display: { enabled: false, widthPx: 6, displayStyle: 'badge' },
    }
  );

  const [entryRows, setEntryRows] = useState<EntryRow[]>(() =>
    loadEntryRows(existing)
  );
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(
    null
  );
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<string>('');
  const [editingGroupIcon, setEditingGroupIcon] = useState<unknown>(undefined);
  const [editingGroupColor, setEditingGroupColor] = useState<
    number | undefined
  >(undefined);
  const [editingGroupIconMode, setEditingGroupIconMode] = useState<
    'name' | 'image'
  >('name');
  const [pendingNewGroup, setPendingNewGroup] = useState<{ id: string } | null>(
    null
  );
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [lastAddedKey, setLastAddedKey] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!lastAddedKey) return;
    // Focus the iRacing ID input of the newly added row
    const el = inputRefs.current[`${lastAddedKey}-id`];
    if (el) {
      el.focus();
      setTimeout(() => setLastAddedKey(null), 0);
    }
  }, [lastAddedKey, entryRows]);

  if (!currentDashboard || !onDashboardUpdated) return <>Loading...</>;

  const updateDashboard = (newSettings: DriverTagSettings) => {
    const updated = {
      ...currentDashboard,
      generalSettings: {
        ...(currentDashboard.generalSettings ?? {}),
        driverTagSettings: newSettings,
      },
    };
    setSettings(newSettings);
    onDashboardUpdated(updated);
  };

  // use shared renderer
  const renderIcon = renderDriverIcon;

  const computeEntries = (rows: EntryRow[]): DriverTagEntry[] =>
    rows
      .map((r) => ({
        id: r.id.trim() || undefined,
        name: r.name.trim() || undefined,
        groupId: r.groupId,
      }))
      .filter((e) => !!(e.id || e.name)) as DriverTagEntry[];

  const syncEntries = (rows: EntryRow[]) => {
    updateDashboard({ ...settings, entries: computeEntries(rows) });
  };

  // Groups: presets (from code) + user-created groups stored in `settings.groups`.
  const addGroup = () => {
    const id = `group-${Date.now()}`;
    setPendingNewGroup({ id });
    setEditingGroupId(id);
    setEditingGroupName('');
    setEditingGroupIcon(undefined);
    setEditingGroupColor(0xff0000);
    setEditingGroupIconMode('name');
  };

  const updateGroup = (
    id: string,
    patch: Partial<{ name: string; color?: number; icon?: string }>
  ) => {
    const groups = [...(settings.groups ?? [])];
    const idx = groups.findIndex((g) => g.id === id);
    if (idx !== -1) {
      groups[idx] = { ...groups[idx], ...patch };
    } else {
      groups.push({
        id,
        name: patch.name ?? 'Custom',
        color: patch.color ?? 0xff0000,
        icon: patch.icon,
      });
    }
    updateDashboard({ ...settings, groups });
  };

  const removeGroup = (id: string) => {
    const groups = (settings.groups ?? []).filter((g) => g.id !== id);
    // Reassign entries from the deleted group to the first available group
    const fallbackGroupId = PRESET_DRIVER_TAGS[0]?.id ?? groups[0]?.id;
    const newRows = entryRows.map((r) =>
      r.groupId === id && fallbackGroupId
        ? { ...r, groupId: fallbackGroupId }
        : r
    );
    setEntryRows(newRows);
    updateDashboard({ ...settings, groups, entries: computeEntries(newRows) });
  };

  // Entry functions
  const addEntry = () => {
    const uiKey = `entry-new-${Date.now()}`;
    const defaultGroup =
      activeGroupFilter ??
      PRESET_DRIVER_TAGS[0]?.id ??
      settings.groups[0]?.id ??
      '';
    setEntryRows((prev) => [
      ...prev,
      { uiKey, id: '', name: '', groupId: defaultGroup },
    ]);
    setLastAddedKey(uiKey);
  };

  const updateEntryDraft = (
    uiKey: string,
    field: 'id' | 'name',
    value: string
  ) => {
    setEntryRows((prev) =>
      prev.map((r) => (r.uiKey === uiKey ? { ...r, [field]: value } : r))
    );
  };

  const commitEntry = (uiKey: string) => {
    const row = entryRows.find((r) => r.uiKey === uiKey);
    if (!row) return;
    // Remove brand-new rows that were never filled in
    if (
      !row.id.trim() &&
      !row.name.trim() &&
      row.uiKey.startsWith('entry-new-')
    ) {
      const newRows = entryRows.filter((r) => r.uiKey !== uiKey);
      setEntryRows(newRows);
      return;
    }
    syncEntries(entryRows);
  };

  const updateEntryGroup = (uiKey: string, groupId: string) => {
    const newRows = entryRows.map((r) =>
      r.uiKey === uiKey ? { ...r, groupId } : r
    );
    setEntryRows(newRows);
    syncEntries(newRows);
  };

  const removeEntry = (uiKey: string) => {
    const newRows = entryRows.filter((r) => r.uiKey !== uiKey);
    setEntryRows(newRows);
    syncEntries(newRows);
  };

  const filteredEntries = entryRows.filter((r) =>
    activeGroupFilter ? r.groupId === activeGroupFilter : true
  );

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
        <div className="flex items-center justify-between">
          <h3 className="text-lg">Groups</h3>
          <div>
            <button
              onClick={addGroup}
              className="px-3 py-1 bg-blue-600 rounded"
            >
              Add Group
            </button>
          </div>
        </div>

        <div className="space-y-2">
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
                      ...(settings.display ?? {}),
                      displayStyle: 'tag',
                    },
                  });
                } else {
                  updateDashboard({
                    ...settings,
                    display: {
                      ...(settings.display ?? {}),
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
                      background: `#${((preset.color ?? 0) & 0xffffff).toString(16).padStart(6, '0')}`,
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
                          placeholder="New Group"
                          className="px-2 py-1 bg-slate-600 rounded text-sm"
                        />
                        {settings.display?.displayStyle === 'tag' ? (
                          <>
                            <input
                              type="color"
                              value={
                                editingGroupColor
                                  ? `#${(editingGroupColor & 0xffffff).toString(16).padStart(6, '0')}`
                                  : '#ff0000'
                              }
                              onChange={(e) =>
                                setEditingGroupColor(
                                  parseInt(e.target.value.replace('#', ''), 16)
                                )
                              }
                              className="w-10 h-6 p-0 border-0"
                            />
                            <span
                              style={{
                                display: 'inline-block',
                                width: 20,
                                height: 20,
                                borderRadius: 6,
                                background: editingGroupColor
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
                                    (editingGroupIcon as string).startsWith(
                                      'data:'
                                    )
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
                                    !(editingGroupIcon as string).startsWith(
                                      'data:'
                                    )
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
                                    !(editingGroupIcon as string).startsWith(
                                      'data:'
                                    )
                                      ? (editingGroupIcon as string) ||
                                        undefined
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
                                  (editingGroupIcon as string).startsWith(
                                    'data:'
                                  ) && (
                                    <img
                                      src={editingGroupIcon as string}
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
                                  (editingGroupIcon as string).startsWith(
                                    'data:'
                                  )
                                  ? (editingGroupIcon as string)
                                  : undefined
                                : typeof editingGroupIcon === 'string' &&
                                    (editingGroupIcon as string).trim()
                                  ? (editingGroupIcon as string).trim()
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
                                  (g.icon as string).startsWith('data:')
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
        </div>

        <div className="pt-4">
          <h3 className="text-lg">Driver Assignments</h3>
          <p className="text-sm text-slate-400">
            Assign drivers by iRacing ID (preferred) and/or display name. Each
            driver may belong to one group.
          </p>

          <div className="space-y-2 mt-2">
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setActiveGroupFilter(null)}
                aria-pressed={activeGroupFilter === null}
                className={`px-3 py-1 rounded font-medium transition-colors shadow-sm ${activeGroupFilter === null ? 'bg-sky-500 text-white ring-2 ring-sky-300' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}
              >
                All
              </button>
              {/** Use preset groups from constants */}
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
                    className={`px-3 py-1 rounded inline-flex items-center gap-1.5 transition-colors shadow-sm text-sm ${activeGroupFilter === g.id ? 'bg-sky-500 text-white ring-2 ring-sky-300 border-sky-500' : 'bg-slate-700 text-slate-200 border border-slate-600 hover:bg-slate-600'}`}
                  >
                    {settings.display?.displayStyle === 'tag' ? (
                      <span
                        style={{
                          display: 'inline-block',
                          width: 10,
                          height: 10,
                          borderRadius: 3,
                          background: `#${((colorNum ?? 0) & 0xffffff).toString(16).padStart(6, '0')}`,
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
                  className={`px-3 py-1 rounded inline-flex items-center gap-1.5 transition-colors shadow-sm text-sm ${activeGroupFilter === g.id ? 'bg-sky-500 text-white ring-2 ring-sky-300 border-sky-500' : 'bg-slate-700 text-slate-200 border border-slate-600 hover:bg-slate-600'}`}
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
              <div className="flex items-center gap-2 text-xs text-slate-400 pb-1">
                <span className="w-32">iRacing ID</span>
                <span className="w-48">iRacing Name</span>
                <span>Group</span>
              </div>
            )}

            {filteredEntries.map((row) => (
              <div key={row.uiKey} className="flex items-center gap-2">
                <input
                  ref={(el) => {
                    inputRefs.current[`${row.uiKey}-id`] = el;
                  }}
                  value={row.id}
                  onChange={(e) =>
                    updateEntryDraft(row.uiKey, 'id', e.target.value)
                  }
                  onBlur={(e) => {
                    // Don't auto-remove if focus is moving to the name input of the same row
                    if (
                      e.relatedTarget === inputRefs.current[`${row.uiKey}-name`]
                    )
                      return;
                    commitEntry(row.uiKey);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter')
                      (e.currentTarget as HTMLInputElement).blur();
                  }}
                  placeholder="e.g. 123456"
                  className="px-2 py-1 bg-slate-700 rounded w-32"
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
                  placeholder="Display name"
                  className="px-2 py-1 bg-slate-700 rounded w-48"
                />
                <select
                  value={row.groupId}
                  onChange={(e) => updateEntryGroup(row.uiKey, e.target.value)}
                  className="px-2 py-1 bg-slate-700 rounded"
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
              as a fallback if no ID is set or no match is found. If a driver
              changes their display name, update the Name field accordingly.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TagGroupsSettings;
