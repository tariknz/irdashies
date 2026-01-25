import { useState } from 'react';
import { useDashboard, useSessionDrivers } from '@irdashies/context';
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

  const sessionDrivers = useSessionDrivers();

  const addMapping = () => {
    const defaultName = sessionDrivers && sessionDrivers.length > 0 ? sessionDrivers[0].UserName : '';
    const name = defaultName ?? '';
    const mapping = { ...settings.mapping, [name]: settings.groups[0]?.id ?? '' };
    updateDashboard({ ...settings, mapping });
  };

  const [editingNames, setEditingNames] = useState<Record<string, string>>({});

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
            {Object.entries(settings.mapping).map(([driver, gid]) => {
              const telemetryNames = sessionDrivers?.map(d => d.UserName) ?? [];
              const isTelemetryName = telemetryNames.includes(driver);
              const selectValue = isTelemetryName ? driver : '__custom__';
              return (
                <div key={driver || '__empty'} className="flex items-center gap-2">
                  <select
                    value={selectValue}
                    onChange={e => {
                      const v = e.target.value;
                      if (v === '__custom__') {
                        // open custom input
                        setEditingNames(prev => ({ ...prev, [driver]: driver }));
                        return;
                      }
                      if (v !== driver) renameMapping(driver, v);
                    }}
                    className="px-2 py-1 bg-slate-700 rounded w-64"
                  >
                    <option value="">(select driver)</option>
                    {/* show current mapping key first if it isn't in telemetry */}
                    {driver && !isTelemetryName ? <option key="current" value={driver}>{driver}</option> : null}
                    {telemetryNames.map((n) => (
                      <option key={n} value={n}>{n}</option>
                    ))}
                    <option value="__custom__">Custom...</option>
                  </select>

                  {/* custom input shown when user selects Custom... or when mapping key isn't in telemetry */}
                  {((!isTelemetryName) || editingNames[driver]) && (
                    <input
                      value={editingNames[driver] ?? driver}
                      onChange={e => setEditingNames(prev => ({ ...prev, [driver]: e.target.value }))}
                      onBlur={() => {
                        const newName = editingNames[driver] ?? driver;
                        if ((newName ?? '').trim() && newName !== driver) {
                          renameMapping(driver, newName);
                        }
                        setEditingNames(prev => { const copy = { ...prev }; delete copy[driver]; return copy; });
                      }}
                      onKeyDown={e => { if (e.key === 'Enter') (e.currentTarget as HTMLInputElement).blur(); }}
                      placeholder="Driver display name"
                      className="px-2 py-1 bg-slate-700 rounded w-64"
                    />
                  )}

                  <select value={gid} onChange={e => updateMapping(driver, e.target.value)} className="px-2 py-1 bg-slate-700 rounded">
                    <option value="">(none)</option>
                    {settings.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                  </select>
                  <button onClick={() => removeMapping(driver)} className="px-2 py-1 bg-red-600 rounded">Remove</button>
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex gap-2">
            <button onClick={addMapping} className="px-3 py-1 bg-green-600 rounded">Add Mapping</button>
          </div>

          <div className="mt-4 p-3 bg-slate-700 rounded">
            <h4 className="text-sm mb-2">Diagnostics</h4>
            <p className="text-xs text-slate-400 mb-2">Compare iRacing telemetry `UserName` values with your saved mapping keys.</p>
            {sessionDrivers && sessionDrivers.length > 0 ? (
              (() => {
                const telemetryNames = sessionDrivers.map(d => d.UserName);
                const mappingKeys = Object.keys(settings.mapping);
                const matched = mappingKeys.filter(k => telemetryNames.includes(k));
                const unmatched = mappingKeys.filter(k => !telemetryNames.includes(k));
                const unmappedTelemetry = telemetryNames.filter(n => !mappingKeys.includes(n));
                return (
                  <div className="text-xs">
                    <div className="mb-1">Telemetry drivers: <strong>{telemetryNames.length}</strong></div>
                    <div className="mb-1">Mapped keys: <strong>{mappingKeys.length}</strong> — matched: <strong>{matched.length}</strong>, unmatched: <strong>{unmatched.length}</strong></div>
                    {unmatched.length > 0 && (
                      <div className="mb-2">
                        <div className="font-medium">Unmatched mapping keys</div>
                        <ul className="list-disc ml-5">
                          {unmatched.map(k => <li key={k} className="break-all">{k}</li>)}
                        </ul>
                      </div>
                    )}
                    {unmappedTelemetry.length > 0 && (
                      <div>
                        <div className="font-medium">Telemetry names not mapped</div>
                        <ul className="list-disc ml-5">
                          {unmappedTelemetry.slice(0, 20).map(n => <li key={n} className="break-all">{n}</li>)}
                          {unmappedTelemetry.length > 20 && <li>and {unmappedTelemetry.length - 20} more...</li>}
                        </ul>
                      </div>
                    )}
                    <div className="mt-2">
                      <button
                        onClick={() => console.log('TagGroups diagnostics', { telemetryNames, mappingKeys, matched, unmatched, unmappedTelemetry })}
                        className="px-2 py-1 bg-slate-600 rounded text-xs"
                      >
                        Log diagnostics to console
                      </button>
                    </div>
                    {/* Widget-level diagnostics */}
                    <div className="mt-3 border-t border-slate-600 pt-3">
                      <div className="font-medium">Widget driverTag status</div>
                      {(() => {
                        const standingsWidget = currentDashboard?.widgets.find(w => w.id === 'standings');
                        const relativeWidget = currentDashboard?.widgets.find(w => w.id === 'relative');
                        const renderWidget = (w: any, label: string) => {
                          if (!w) return <div key={label} className="text-xs text-slate-400">{label}: not present</div>;
                          const cfg = w.config ?? {};
                          const drvTag = cfg.driverTag ?? {};
                          const displayOrder = cfg.displayOrder ?? [];
                          const inDisplay = Array.isArray(displayOrder) ? displayOrder.includes('driverTag') : false;
                          return (
                            <div key={label} className="text-xs">
                              <div>{label}: enabled={String(drvTag.enabled ?? false)}, position={drvTag.position ?? 'before-name'}, widthPx={drvTag.widthPx ?? 6}, inDisplayOrder={String(inDisplay)}</div>
                            </div>
                          );
                        };

                        return (
                          <div className="text-xs mt-2">
                            {renderWidget(standingsWidget, 'Standings')}
                            {renderWidget(relativeWidget, 'Relative')}
                          </div>
                        );
                      })()}
                    </div>
                  </div>
                );
              })()
            ) : (
              <div className="text-xs text-slate-400">No telemetry drivers available in this session.</div>
            )}
          </div>
        </div>

        {/* Display for tag strips is configured per-widget in Standings/Relative settings. */}
      </div>
    </div>
  );
};

export default TagGroupsSettings;
