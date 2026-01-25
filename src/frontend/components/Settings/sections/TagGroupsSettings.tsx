import { useState, useEffect, useRef } from 'react';
// colorNumToHex is handled by the shared renderer
import { useDashboard } from '@irdashies/context';
import type { DriverTagSettings } from '@irdashies/types';
import { PRESET_DRIVER_TAGS } from '../../../constants/driverTagBadges';
import { renderDriverIcon } from '../../../utils/driverIcons';

// Preset badge groups are provided by code; colors and dynamic groups removed.

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

  const [editingNames, setEditingNames] = useState<Record<string, string>>({});
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<string>('');
  const [editingGroupIcon, setEditingGroupIcon] = useState<unknown>(undefined);
  const [editingGroupColor, setEditingGroupColor] = useState<number | undefined>(undefined);
  const [editingPresetId, setEditingPresetId] = useState<string | null>(null);
  const [editingPresetIcon, setEditingPresetIcon] = useState<unknown>(undefined);
  const [editingPresetColor, setEditingPresetColor] = useState<number | undefined>(undefined);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [lastAddedKey, setLastAddedKey] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  useEffect(() => {
    if (!lastAddedKey) return;
    // wait for DOM to update
    const el = inputRefs.current[lastAddedKey];
    if (el) {
      el.focus();
      el.select();
      // defer clearing to avoid synchronous state update in the effect
      setTimeout(() => setLastAddedKey(null), 0);
    }
  }, [lastAddedKey, settings.mapping]);

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

  const userGroups = settings.groups ?? [];

  // use shared renderer
  const renderIcon = renderDriverIcon;

  // Groups: presets (from code) + user-created groups stored in `settings.groups`.
  const addGroup = () => {
    const id = `group-${Date.now()}`;
    const group = { id, name: 'New Group', color: 0xff0000 };
    updateDashboard({ ...settings, groups: [...userGroups, group] });
  };

  const updateGroup = (id: string, patch: Partial<{ name: string; color?: number; icon?: string }>) => {
    const groups = [...(settings.groups ?? [])];
    const idx = groups.findIndex(g => g.id === id);
    if (idx !== -1) {
      groups[idx] = { ...groups[idx], ...patch };
    } else {
      groups.push({ id, name: patch.name ?? 'Custom', color: patch.color ?? 0xff0000, icon: patch.icon });
    }
    updateDashboard({ ...settings, groups });
  };

  const setPresetOverride = (id: string, patch: Partial<{ name?: string; color?: number; icon?: string }>) => {
    const overrides = { ...(settings.presetOverrides ?? {}) };
    overrides[id] = { ...(overrides[id] ?? {}), ...patch };
    updateDashboard({ ...settings, presetOverrides: overrides });
  };

  const removePresetOverride = (id: string) => {
    if (!settings.presetOverrides) return;
    const overrides = { ...(settings.presetOverrides ?? {}) };
    const rest = Object.fromEntries(Object.entries(overrides).filter(([k]) => k !== id));
    updateDashboard({ ...settings, presetOverrides: Object.keys(rest).length ? rest : undefined });
  };

  const removeGroup = (id: string) => {
    const groups = (settings.groups ?? []).filter(g => g.id !== id);
    const mapping = Object.fromEntries(Object.entries(settings.mapping).filter(entry => entry[1] !== id));
    updateDashboard({ ...settings, groups, mapping });
  };

  const addMapping = () => {
    const tmpKey = `__new__:${Date.now()}`;
    const mapping = { ...settings.mapping, [tmpKey]: activeGroupFilter ?? PRESET_DRIVER_TAGS[0]?.id ?? settings.groups[0]?.id ?? '' };
    setEditingNames(prev => ({ ...prev, [tmpKey]: '' }));
    updateDashboard({ ...settings, mapping });
    setLastAddedKey(tmpKey);
  };
  const renameMapping = (oldName: string, newName: string) => {
    const name = newName?.trim();
    if (!name) return;
    // Prevent renaming to an existing driver name which would overwrite that entry.
    if (name === oldName) return;
    if (Object.prototype.hasOwnProperty.call(settings.mapping, name)) return;
    const entries = Object.entries(settings.mapping).map(([k, v]) => [k === oldName ? name : k, v] as [string, string]);
    const mapping = Object.fromEntries(entries);
    updateDashboard({ ...settings, mapping });
  };

  const updateMapping = (driverName: string, groupId: string) => {
    const mapping = { ...settings.mapping };
    if (!driverName) return;
    mapping[driverName] = groupId;
    updateDashboard({ ...settings, mapping });
  };
  const removeMapping = (driverName: string) => {
    const mapping = Object.fromEntries(
      Object.entries(settings.mapping).filter(([k]) => k !== driverName)
    );
    updateDashboard({ ...settings, mapping });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 bg-slate-700 rounded">
        <h2 className="text-xl mb-2">Driver Tags</h2>
        <p className="text-slate-400">Create color-coded driver tag groups and assign drivers by iRacing name. Tags are saved to your user configuration.</p>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0 p-4 space-y-4 mt-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg">Groups</h3>
          <div>
            <button onClick={addGroup} className="px-3 py-1 bg-blue-600 rounded">Add Group</button>
          </div>
        </div>

          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <label className="text-sm text-slate-300">Display style:</label>
              <select
                value={settings.display?.displayStyle ?? 'badge'}
                onChange={e => updateDashboard({ ...settings, display: { ...(settings.display ?? {}), displayStyle: e.target.value as 'badge' | 'tag' } })}
                className="px-2 py-1 bg-slate-700 rounded text-sm"
              >
                <option value="badge">Badges (icons)</option>
                <option value="tag">Tags (colored pills)</option>
              </select>
            </div>
            <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm text-slate-300">Preset groups:</div>
            {PRESET_DRIVER_TAGS.map((preset) => {
              const override = settings.presetOverrides?.[preset.id];
              if (editingPresetId === preset.id) {
                return (
                      <div key={preset.id} className="inline-flex items-center gap-2 px-2 py-1 rounded bg-slate-800 text-sm text-slate-100">
                    <span className="whitespace-nowrap">{preset.name}</span>
                    {settings.display?.displayStyle === 'tag' ? (
                      <>
                        <input
                          type="color"
                          value={editingPresetColor ? `#${(editingPresetColor & 0xffffff).toString(16).padStart(6,'0')}` : '#ff0000'}
                          onChange={e => setEditingPresetColor(parseInt(e.target.value.replace('#',''), 16))}
                          className="w-10 h-6 p-0 border-0"
                        />
                        <span style={{ display: 'inline-block', width: 20, height: 20, borderRadius: 6, background: editingPresetColor ? `#${(editingPresetColor & 0xffffff).toString(16).padStart(6,'0')}` : '#ff0000' }} />
                      </>
                    ) : (
                      <>
                        <input
                          ref={el => { fileInputRef.current = el; }}
                          type="file"
                          accept="image/*"
                          onChange={e => {
                            const f = e.target.files?.[0];
                            if (!f) return;
                            const reader = new FileReader();
                            reader.onload = () => setEditingPresetIcon(reader.result as string);
                            reader.readAsDataURL(f);
                          }}
                          className="hidden"
                        />
                        <button onClick={() => fileInputRef.current?.click()} className="px-2 py-1 bg-slate-600 rounded text-xs">Add custom badge</button>
                        {typeof editingPresetIcon === 'string' && editingPresetIcon.startsWith('data:') ? (
                          <img src={editingPresetIcon} alt="preview" className="w-8 h-8 object-contain rounded" />
                        ) : (
                          renderIcon(editingPresetIcon, 24)
                        )}
                      </>
                    )}
                    <button onClick={() => { setPresetOverride(preset.id, { icon: (typeof editingPresetIcon === 'string' && editingPresetIcon.startsWith('data:')) ? editingPresetIcon : undefined, color: editingPresetColor }); setEditingPresetId(null); setEditingPresetIcon(undefined); setEditingPresetColor(undefined); }} className="px-2 py-1 bg-sky-600 rounded text-xs">Save</button>
                    <button onClick={() => { setEditingPresetId(null); setEditingPresetIcon(undefined); setEditingPresetColor(undefined); }} className="px-2 py-1 bg-slate-600 rounded text-xs">Cancel</button>
                  </div>
                );
              }
              return (
                <div key={preset.id} className="inline-flex items-center gap-2 px-2 py-1 rounded bg-slate-800 text-sm text-slate-100">
                  {settings.display?.displayStyle === 'tag' ? (
                    <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: 6, background: `#${(((override?.color ?? preset.color) ?? 0) & 0xffffff).toString(16).padStart(6,'0')}` }} />
                    ) : (
                    <span className="inline-flex items-center justify-center w-8 h-8 text-xl leading-none" aria-hidden="true">{override?.icon ? renderIcon(override.icon, 24, undefined, override?.color ?? preset.color) : renderIcon(preset.icon, 24, undefined, override?.color ?? preset.color)}</span>
                  )}
                  <span className="whitespace-nowrap">{preset.name}</span>
                  <div className="ml-2 inline-flex items-center gap-1">
                    <button
                      onClick={() => {
                        setEditingPresetId(preset.id);
                        setEditingPresetIcon(override?.icon ?? undefined);
                        setEditingPresetColor(override?.color ?? preset.color);
                      }}
                      className="text-xs text-slate-300 px-1"
                    >
                      Edit
                    </button>
                    {override ? (
                      <button onClick={() => removePresetOverride(preset.id)} className="text-xs text-red-400 px-1">Remove override</button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {(settings.groups ?? []).length > 0 && (
            <div className="mt-2">
              <div className="text-sm text-slate-300 mb-2">Custom groups:</div>
              <div className="flex flex-col gap-2">
                {(settings.groups ?? []).map((g) => (
                  <div key={g.id} className="inline-flex w-auto self-start items-center gap-3 px-2 py-1 rounded bg-slate-700 text-sm text-slate-100">
                    {editingGroupId === g.id ? (
                      <div className="flex items-center gap-2">
                        <input value={editingGroupName} onChange={e => setEditingGroupName(e.target.value)} className="px-2 py-1 bg-slate-600 rounded text-sm" />
                        {settings.display?.displayStyle === 'tag' ? (
                          <>
                            <input
                              type="color"
                              value={editingGroupColor ? `#${(editingGroupColor & 0xffffff).toString(16).padStart(6,'0')}` : '#ff0000'}
                              onChange={e => setEditingGroupColor(parseInt(e.target.value.replace('#',''), 16))}
                              className="w-10 h-6 p-0 border-0"
                            />
                            <span style={{ display: 'inline-block', width: 20, height: 20, borderRadius: 6, background: editingGroupColor ? `#${(editingGroupColor & 0xffffff).toString(16).padStart(6,'0')}` : '#ff0000' }} />
                          </>
                        ) : (
                          <>
                            <input
                              ref={el => { fileInputRef.current = el; }}
                              type="file"
                              accept="image/*"
                              onChange={e => {
                                const f = e.target.files?.[0];
                                if (!f) return;
                                const reader = new FileReader();
                                reader.onload = () => setEditingGroupIcon(reader.result as string);
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
                            {typeof editingGroupIcon === 'string' && editingGroupIcon.startsWith('data:') ? (
                              <img src={editingGroupIcon as string} alt="preview" className="w-8 h-8 object-contain rounded" />
                            ) : (
                              renderIcon(editingGroupIcon, 24)
                            )}
                          </>
                        )}
                        <button onClick={() => { updateGroup(g.id, { name: editingGroupName, icon: (typeof editingGroupIcon === 'string' && editingGroupIcon.startsWith('data:')) ? editingGroupIcon : undefined, color: editingGroupColor }); setEditingGroupId(null); setEditingGroupIcon(undefined); setEditingGroupColor(undefined); }} className="px-2 py-1 bg-sky-600 rounded text-xs">Save</button>
                        <button onClick={() => { setEditingGroupId(null); setEditingGroupIcon(undefined); setEditingGroupColor(undefined); }} className="px-2 py-1 bg-slate-600 rounded text-xs">Cancel</button>
                      </div>
                    ) : (
                      <>
                        {settings.display?.displayStyle === 'tag' ? (
                          <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: 6, background: g.color ? `#${(g.color & 0xffffff).toString(16).padStart(6,'0')}` : '#888' }} />
                        ) : (
                          g.icon && (typeof g.icon === 'string' && g.icon.startsWith('data:')) ? (
                            <img src={g.icon} alt={g.name} className="w-7 h-7 object-contain" />
                          ) : (
                            <span className="inline-flex items-center justify-center w-8 h-8 text-xl leading-none" aria-hidden="true">{renderIcon(g.icon, 24, undefined, g.color) ?? '🔖'}</span>
                          )
                        )}
                        <span className="whitespace-nowrap">{g.name}</span>
                        <div className="ml-auto flex-none inline-flex items-center gap-2">
                          <button onClick={() => { setEditingGroupId(g.id); setEditingGroupName(g.name); setEditingGroupIcon(g.icon); setEditingGroupColor(g.color); }} className="flex-none w-auto px-2 py-0.5 text-xs text-slate-300">Edit</button>
                          <button onClick={() => removeGroup(g.id)} className="flex-none w-auto px-2 py-0.5 text-xs text-red-400">Delete</button>
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
          <p className="text-sm text-slate-400">Assign drivers by their iRacing display name. Each driver may belong to one group.</p>

          <div className="space-y-2 mt-2">
            <div className="flex items-center gap-2 mb-3">
              <button
                onClick={() => setActiveGroupFilter(null)}
                aria-pressed={activeGroupFilter === null}
                className={`px-3 py-1 rounded font-medium transition-colors shadow-sm ${activeGroupFilter === null ? 'bg-sky-500 text-white ring-2 ring-sky-300' : 'bg-slate-700 text-slate-200 hover:bg-slate-600'}`}>
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
                    onClick={() => setActiveGroupFilter(activeGroupFilter === g.id ? null : g.id)}
                    aria-pressed={activeGroupFilter === g.id}
                    title={name}
                    aria-label={name}
                    className={`px-3 py-1 rounded inline-flex items-center gap-2 transition-colors shadow-sm text-sm ${activeGroupFilter === g.id ? 'bg-sky-500 text-white ring-2 ring-sky-300 border-sky-500' : 'bg-slate-700 text-slate-200 border border-slate-600 hover:bg-slate-600'}`}>
                    {settings.display?.displayStyle === 'tag' ? (
                      <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: 6, background: `#${((colorNum ?? 0) & 0xffffff).toString(16).padStart(6,'0')}` }} />
                    ) : (
                      <span className="inline-flex items-center justify-center w-8 h-8 text-xl leading-none" aria-hidden="true">{renderIcon(icon, 24, undefined, colorNum)}</span>
                    )}
                    <span className="align-middle">{name}</span>
                  </button>
                );
              })}
              {(settings.groups ?? []).map((g) => (
                <button
                  key={g.id}
                  onClick={() => setActiveGroupFilter(activeGroupFilter === g.id ? null : g.id)}
                  aria-pressed={activeGroupFilter === g.id}
                  title={g.name}
                  aria-label={g.name}
                  className={`px-3 py-1 rounded inline-flex items-center gap-2 transition-colors shadow-sm text-sm ${activeGroupFilter === g.id ? 'bg-sky-500 text-white ring-2 ring-sky-300 border-sky-500' : 'bg-slate-700 text-slate-200 border border-slate-600 hover:bg-slate-600'}`}>
                  {settings.display?.displayStyle === 'tag' ? (
                    <span style={{ display: 'inline-block', width: 16, height: 16, borderRadius: 6, background: g.color ? `#${(g.color & 0xffffff).toString(16).padStart(6,'0')}` : '#888' }} />
                  ) : (
                      <span className="text-lg leading-none" aria-hidden="true">{renderIcon(g.icon, 24, undefined, g.color) ?? '🔖'}</span>
                    )}
                    <span className="align-middle">{g.name}</span>
                </button>
              ))}
            </div>

            <div className="mb-3">
              <button onClick={addMapping} className="px-3 py-1 bg-green-600 rounded">Add Driver</button>
            </div>

            {Object.entries(settings.mapping)
              .filter(([, gid]) => (activeGroupFilter ? gid === activeGroupFilter : true))
              .map(([driverKey, gid], idx) => {
              const inputValue = editingNames[driverKey] ?? (driverKey.startsWith('__new__:') ? '' : driverKey);
              return (
                <div key={driverKey || `mapping-${idx}`} className="flex items-center gap-2">
                  <input
                    ref={el => { inputRefs.current[driverKey] = el }}
                    value={inputValue}
                    onChange={e => setEditingNames(prev => ({ ...prev, [driverKey]: e.target.value }))}
                    onBlur={() => {
                      const newName = (editingNames[driverKey] ?? inputValue).trim();
                      if (!newName) {
                        if (driverKey.startsWith('__new__:')) removeMapping(driverKey);
                      } else if (newName !== driverKey) {
                        renameMapping(driverKey, newName);
                      }
                      setEditingNames(prev => {
                        const rest = Object.fromEntries(Object.entries(prev).filter(([k]) => k !== driverKey));
                        return rest;
                      });
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
                    placeholder="Enter iRacing display name"
                    className="px-2 py-1 bg-slate-700 rounded w-64"
                  />

                  <select value={gid} onChange={e => updateMapping(driverKey, e.target.value)} className="px-2 py-1 bg-slate-700 rounded">
                    {PRESET_DRIVER_TAGS.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                    {(settings.groups ?? []).map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <button onClick={() => removeMapping(driverKey)} className="px-2 py-1 bg-red-600 rounded">Remove</button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Display for tag strips is configured per-widget in Standings/Relative settings. */}
      </div>
    </div>
  );
};

export default TagGroupsSettings;
