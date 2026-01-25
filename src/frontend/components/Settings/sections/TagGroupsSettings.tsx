import { useState, useEffect, useRef } from 'react';
import { useDashboard } from '@irdashies/context';
import type { DriverTagSettings } from '@irdashies/types';
import { PRESET_DRIVER_TAGS } from '../../../constants/driverTagBadges';

// Preset badge groups are provided by code; colors and dynamic groups removed.

export const TagGroupsSettings = () => {
  const { currentDashboard, onDashboardUpdated } = useDashboard();

  const existing = currentDashboard?.generalSettings?.driverTagSettings;
  const [settings, setSettings] = useState<DriverTagSettings>(
    existing ?? {
      groups: [],
      mapping: {},
      display: { enabled: false, position: 'before-name', widthPx: 6 },
    }
  );

  const [editingNames, setEditingNames] = useState<Record<string, string>>({});
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null);
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState<string>('');
  const [editingGroupIcon, setEditingGroupIcon] = useState<string | undefined>(undefined);
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

  // Groups: presets (from code) + user-created groups stored in `settings.groups`.
  const addGroup = () => {
    const id = `group-${Date.now()}`;
    const group = { id, name: 'New Group', color: 0xff0000 };
    updateDashboard({ ...settings, groups: [...(settings.groups ?? []), group] });
    setTimeout(() => {
      // focus new mapping input when user adds a mapping afterwards
    }, 0);
  };

  const updateGroup = (id: string, patch: Partial<{ name: string; color?: number; icon?: string }>) => {
    const groups = (settings.groups ?? []).map(g => (g.id === id ? { ...g, ...patch } : g));
    updateDashboard({ ...settings, groups });
  };

  const removeGroup = (id: string) => {
    const groups = (settings.groups ?? []).filter(g => g.id !== id);
    const mapping = Object.fromEntries(Object.entries(settings.mapping).filter(entry => entry[1] !== id));
    updateDashboard({ ...settings, groups, mapping });
  };

  const addMapping = () => {
    const tmpKey = `__new__:${Date.now()}`;
    const mapping = { ...settings.mapping, [tmpKey]: activeGroupFilter ?? settings.groups[0]?.id ?? '' };
    setEditingNames(prev => ({ ...prev, [tmpKey]: '' }));
    updateDashboard({ ...settings, mapping });
    setLastAddedKey(tmpKey);
  };
  const renameMapping = (oldName: string, newName: string) => {
    const name = newName?.trim();
    if (!name) return;
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
            <div className="flex flex-wrap items-center gap-3">
            <div className="text-sm text-slate-300">Preset groups:</div>
            {PRESET_DRIVER_TAGS.map((g: { id: string; name: string; icon: string }) => (
              <div key={g.id} className="inline-flex items-center gap-2 px-2 py-1 rounded bg-slate-800 text-sm text-slate-100">
                <span className="text-lg leading-none" aria-hidden="true">{g.icon}</span>
                <span className="whitespace-nowrap">{g.name}</span>
              </div>
            ))}
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
                        {editingGroupIcon ? (
                          <img src={editingGroupIcon} alt="preview" className="w-6 h-6 object-contain rounded" />
                        ) : null}
                        <button onClick={() => { updateGroup(g.id, { name: editingGroupName, icon: editingGroupIcon }); setEditingGroupId(null); setEditingGroupIcon(undefined); }} className="px-2 py-1 bg-sky-600 rounded text-xs">Save</button>
                        <button onClick={() => { setEditingGroupId(null); setEditingGroupIcon(undefined); }} className="px-2 py-1 bg-slate-600 rounded text-xs">Cancel</button>
                      </div>
                    ) : (
                      <>
                        {g.icon && (typeof g.icon === 'string' && g.icon.startsWith('data:')) ? (
                          <img src={g.icon} alt={g.name} className="w-5 h-5 object-contain" />
                        ) : (
                          <span className="text-lg leading-none" aria-hidden="true">{g.icon ?? '🔖'}</span>
                        )}
                        <span className="whitespace-nowrap">{g.name}</span>
                        <div className="ml-auto flex-none inline-flex items-center gap-2">
                          <button onClick={() => { setEditingGroupId(g.id); setEditingGroupName(g.name); setEditingGroupIcon(g.icon); }} className="flex-none w-auto px-2 py-0.5 text-xs text-slate-300">Edit</button>
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
              {PRESET_DRIVER_TAGS.map((g: { id: string; name: string; icon: string }) => (
                <button
                  key={g.id}
                  onClick={() => setActiveGroupFilter(activeGroupFilter === g.id ? null : g.id)}
                  aria-pressed={activeGroupFilter === g.id}
                  title={g.name}
                  aria-label={g.name}
                  className={`px-3 py-1 rounded inline-flex items-center gap-2 transition-colors shadow-sm text-sm ${activeGroupFilter === g.id ? 'bg-sky-500 text-white ring-2 ring-sky-300 border-sky-500' : 'bg-slate-700 text-slate-200 border border-slate-600 hover:bg-slate-600'}`}>
                  <span className="text-lg leading-none" aria-hidden="true">{g.icon}</span>
                  <span className="align-middle">{g.name}</span>
                </button>
              ))}
              {(settings.groups ?? []).map((g) => (
                <button
                  key={g.id}
                  onClick={() => setActiveGroupFilter(activeGroupFilter === g.id ? null : g.id)}
                  aria-pressed={activeGroupFilter === g.id}
                  title={g.name}
                  aria-label={g.name}
                  className={`px-3 py-1 rounded inline-flex items-center gap-2 transition-colors shadow-sm text-sm ${activeGroupFilter === g.id ? 'bg-sky-500 text-white ring-2 ring-sky-300 border-sky-500' : 'bg-slate-700 text-slate-200 border border-slate-600 hover:bg-slate-600'}`}>
                  {g.icon && (typeof g.icon === 'string' && g.icon.startsWith('data:')) ? (
                    <img src={g.icon} alt={g.name} className="w-5 h-5 object-contain" />
                  ) : (
                    <span className="text-lg leading-none" aria-hidden="true">{g.icon ?? '🔖'}</span>
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
                    {PRESET_DRIVER_TAGS.map((g: { id: string; name: string; icon: string }) => <option key={g.id} value={g.id}>{g.name}</option>)}
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
