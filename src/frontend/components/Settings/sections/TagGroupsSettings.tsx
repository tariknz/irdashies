import { useState } from 'react';
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
    const name = '';
    const mapping = { ...settings.mapping, [name]: settings.groups[0]?.id ?? '' };
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
        <h2 className="text-xl mb-2">Tag Groups</h2>
        <p className="text-slate-400">Create color-coded tag groups and assign drivers by iRacing name. Tags are saved to your user configuration.</p>
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
            {Object.entries(settings.mapping).map(([driver, gid]) => (
              <div key={driver} className="flex items-center gap-2">
                <input value={driver} readOnly className="px-2 py-1 bg-slate-700 rounded w-64" />
                <select value={gid} onChange={e => updateMapping(driver, e.target.value)} className="px-2 py-1 bg-slate-700 rounded">
                  <option value="">(none)</option>
                  {settings.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                </select>
                <button onClick={() => removeMapping(driver)} className="px-2 py-1 bg-red-600 rounded">Remove</button>
              </div>
            ))}
          </div>

          <div className="mt-2 flex gap-2">
            <button onClick={addMapping} className="px-3 py-1 bg-green-600 rounded">Add Mapping</button>
          </div>
        </div>

        {/* Display for tag strips is configured per-widget in Standings/Relative settings. */}
      </div>
    </div>
  );
};

export default TagGroupsSettings;
