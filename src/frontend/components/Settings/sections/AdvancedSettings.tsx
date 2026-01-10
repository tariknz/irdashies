import { useState } from 'react';
import { useDashboard } from '@irdashies/context';
import { TelemetryInspectorSettings } from './TelemetryInspectorSettings';

export const AdvancedSettings = () => {
  const { currentDashboard, onDashboardUpdated, resetDashboard } = useDashboard();
  const [dashboardInput, setDashboardInput] = useState<string | undefined>(
    JSON.stringify(currentDashboard, undefined, 2)
  );

  if (!currentDashboard || !onDashboardUpdated) {
    return <>Loading...</>;
  }

  const onInputUpdated = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDashboardInput(e.target.value);
  };

  const handleSave = () => {
    if (!dashboardInput) {
      return;
    }

    try {
      const dashboard = JSON.parse(dashboardInput);
      onDashboardUpdated(dashboard, { forceReload: true });
    } catch (e) {
      console.error(e);
      alert('Invalid JSON format');
    }
  };

  const handleResetConfigs = async () => {
    if (!confirm('Reset all widget configurations to defaults? This will preserve widget positions and enabled states.')) {
      return;
    }

    try {
      const result = await resetDashboard(false);
      setDashboardInput(JSON.stringify(result, undefined, 2));
    } catch (e) {
      console.error('Failed to reset configurations:', e);
      alert('Failed to reset configurations');
    }
  };

  const handleResetCompletely = async () => {
    if (!confirm('Reset everything to defaults? This will reset all widget positions, enabled states, and configurations.')) {
      return;
    }

    try {
      const result = await resetDashboard(true);
      setDashboardInput(JSON.stringify(result, undefined, 2));
    } catch (e) {
      console.error('Failed to reset dashboard:', e);
      alert('Failed to reset dashboard');
    }
  };

  return (
    <div className="flex flex-col h-full space-y-4 overflow-y-auto">
      <div>
        <h2 className="text-xl mb-4">Advanced</h2>
        <p className="text-slate-400 mb-4">Configure advanced system settings and preferences.</p>
      </div>

      {/* Telemetry Inspector Section */}
      <div className="border border-slate-600 rounded-md">
        <details className="group">
          <summary className="cursor-pointer p-4 hover:bg-slate-700 rounded-t-md transition-colors list-none">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Telemetry Inspector</h3>
              <span className="text-slate-400 group-open:rotate-90 transition-transform">▶</span>
            </div>
            <p className="text-sm text-slate-400 mt-1">Debug widget to display raw telemetry and session values</p>
          </summary>
          <div className="p-4 border-t border-slate-600">
            <TelemetryInspectorSettings />
          </div>
        </details>
      </div>

      {/* Dashboard Configuration Section */}
      <div className="border border-slate-600 rounded-md">
        <details className="group" open>
          <summary className="cursor-pointer p-4 hover:bg-slate-700 rounded-t-md transition-colors list-none">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Dashboard Configuration</h3>
              <span className="text-slate-400 group-open:rotate-90 transition-transform">▶</span>
            </div>
            <p className="text-sm text-slate-400 mt-1">Edit raw dashboard JSON and reset settings</p>
          </summary>
          <div className="p-4 border-t border-slate-600 flex flex-col space-y-4">
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={handleResetConfigs}
                className="flex-1 bg-amber-700 hover:bg-amber-600 rounded px-4 py-2 transition-colors cursor-pointer"
              >
                Reset Configurations
              </button>
              <button
                type="button"
                onClick={handleResetCompletely}
                className="flex-1 bg-red-700 hover:bg-red-600 rounded px-4 py-2 transition-colors cursor-pointer"
              >
                Reset Everything
              </button>
            </div>

            <textarea
              className="w-full h-96 bg-slate-800 p-4 font-mono text-sm rounded border border-slate-600 focus:border-slate-500 focus:outline-none"
              value={dashboardInput}
              onChange={onInputUpdated}
              placeholder="Dashboard configuration JSON..."
            />

            <div>
              <button
                type="button"
                onClick={handleSave}
                className="w-full bg-slate-700 hover:bg-slate-600 rounded px-4 py-2 transition-colors cursor-pointer"
              >
                Save
              </button>
            </div>
          </div>
        </details>
      </div>
    </div>
  );
}; 