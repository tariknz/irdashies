import { useState, useEffect, useRef } from 'react';
import { useDashboard } from '@irdashies/context';
import type { TagGroup, DriverTagSettings } from '@irdashies/types';

const colorNumberToHex = (n: number) => `#${n.toString(16).padStart(6, '0')}`;
const hexToNumber = (h: string) => parseInt(h.replace('#', ''), 16) || 0;

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

  const addGroup = () => {
    const id = `group-${Date.now()}`;
    const group: TagGroup = { id, name: 'New Group', color: 0xff0000 };
    updateDashboard({ ...settings, groups: [...settings.groups, group] });
  };

  const updateGroup = (id: string, patch: Partial<TagGroup>) => {
    const groups = settings.groups.map(g => (g.id === id ? { ...g, ...patch } : g));
    updateDashboard({ ...settings, groups });
  };

  const removeGroup = (id: string) => {
    const groups = settings.groups.filter((g) => g.id !== id);
    const mapping = Object.fromEntries(
      Object.entries(settings.mapping).filter(([, v]) => v !== id)
    );
    updateDashboard({ ...settings, groups, mapping });
  };

  const addMapping = () => {
    const tmpKey = `__new__:${Date.now()}`;
    const mapping = { ...settings.mapping, [tmpKey]: activeGroupFilter ?? settings.groups[0]?.id ?? '' };
    setEditingNames(prev => ({ ...prev, [tmpKey]: '' }));
    updateDashboard({ ...settings, mapping });
    setLastAddedKey(tmpKey);
  };

  const [editingNames, setEditingNames] = useState<Record<string, string>>({});
  const [activeGroupFilter, setActiveGroupFilter] = useState<string | null>(null);
  const [lastAddedKey, setLastAddedKey] = useState<string | null>(null);
  const inputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const renameMapping = (oldName: string, newName: string) => {
    const name = newName?.trim();
    if (!name) return;
    const mapping = { ...settings.mapping };
    const value = mapping[oldName];
    if (value === undefined) return;
    mapping[name] = value;
    if (oldName in mapping) delete mapping[oldName];
    updateDashboard({ ...settings, mapping });
  };

  const updateMapping = (driverName: string, groupId: string) => {
    const mapping = { ...settings.mapping };
    if (!driverName) return;
    mapping[driverName] = groupId;
    updateDashboard({ ...settings, mapping });
  };

  useEffect(() => {
    if (!lastAddedKey) return;
    // wait for DOM to update
    const el = inputRefs.current[lastAddedKey];
    if (el) {
      el.focus();
      el.select();
      setLastAddedKey(null);
    }
  }, [lastAddedKey, settings.mapping]);

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
          <button onClick={addGroup} className="px-3 py-1 bg-blue-600 rounded">Add Group</button>
        </div>

        <div className="space-y-2">
          {settings.groups.map(g => (
            <div key={g.id} className="flex items-center gap-2">
              <input value={g.name} onChange={e => updateGroup(g.id, { name: e.target.value })} className="px-2 py-1 bg-slate-700 rounded" />
              <input type="color" value={colorNumberToHex(g.color)} onChange={e => updateGroup(g.id, { color: hexToNumber(e.target.value) })} />
              <button onClick={() => removeGroup(g.id)} className="px-2 py-1 bg-red-600 rounded">Delete</button>
            </div>
          ))}
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
              {settings.groups.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setActiveGroupFilter(activeGroupFilter === g.id ? null : g.id)}
                  aria-pressed={activeGroupFilter === g.id}
                  title={g.name}
                  style={{ borderColor: colorNumberToHex(g.color) }}
                  className={`px-3 py-1 rounded border-2 font-medium transition-colors shadow-sm ${activeGroupFilter === g.id ? 'bg-sky-500 text-white ring-2 ring-sky-300 border-sky-500' : 'bg-slate-700 text-slate-200 border-slate-600 hover:bg-slate-600'}`}>
                  <span className="inline-block w-3 h-3 mr-2 align-middle" style={{ backgroundColor: colorNumberToHex(g.color) }} />
                  {g.name}
                </button>
              ))}
            </div>

            <div className="mb-3">
              <button onClick={addMapping} className="px-3 py-1 bg-green-600 rounded">Add Driver</button>
            </div>

            {Object.entries(settings.mapping)
              .filter(([driverKey, gid]) => (activeGroupFilter ? gid === activeGroupFilter : true))
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
                      setEditingNames(prev => { const copy = { ...prev }; delete copy[driverKey]; return copy; });
                    }}
                    onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
                    placeholder="Enter iRacing display name"
                    className="px-2 py-1 bg-slate-700 rounded w-64"
                  />

                  <select value={gid} onChange={e => updateMapping(driverKey, e.target.value)} className="px-2 py-1 bg-slate-700 rounded">
                    {settings.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
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
