import { useState } from 'react';
import { useDashboard } from '@irdashies/context';
import { UploadSimpleIcon, DownloadSimpleIcon } from '@phosphor-icons/react';
import { TelemetryInspectorSettings } from './TelemetryInspectorSettings';
import { TabButton } from '../components/TabButton';
import { SettingsTabType } from '@irdashies/types';
import logger from '@irdashies/utils/logger';

export const AdvancedSettings = () => {
  const { currentDashboard, onDashboardUpdated, resetDashboard, bridge } =
    useDashboard();
  const [dashboardInput, setDashboardInput] = useState<string | undefined>(
    JSON.stringify(currentDashboard, undefined, 2)
  );
  const [activeTab, setActiveTab] = useState<SettingsTabType>('dashboard');

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
      logger.error(e);
      alert('Invalid JSON format');
    }
  };

  const handleExport = async () => {
    if (!dashboardInput) return;
    try {
      const dashboard = JSON.parse(dashboardInput);
      await bridge.exportDashboardToFile(dashboard);
    } catch (e) {
      logger.error('Export failed:', e);
      alert('Invalid JSON — fix errors before exporting');
    }
  };

  const handleImport = async () => {
    const imported = await bridge.importDashboardFromFile();
    if (imported) {
      setDashboardInput(JSON.stringify(imported, undefined, 2));
      onDashboardUpdated(imported, { forceReload: true });
    }
  };

  const handleResetConfigs = async () => {
    if (
      !confirm(
        'Reset all widget configurations to defaults? This will preserve widget positions and enabled states.'
      )
    ) {
      return;
    }

    try {
      const result = await resetDashboard(false);
      setDashboardInput(JSON.stringify(result, undefined, 2));
    } catch (e) {
      logger.error('Failed to reset configurations:', e);
      alert('Failed to reset configurations');
    }
  };

  const handleResetCompletely = async () => {
    if (
      !confirm(
        'Reset everything to defaults? This will reset all widget positions, enabled states, and configurations.'
      )
    ) {
      return;
    }

    try {
      const result = await resetDashboard(true);
      setDashboardInput(JSON.stringify(result, undefined, 2));
    } catch (e) {
      logger.error('Failed to reset dashboard:', e);
      alert('Failed to reset dashboard');
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none p-4 bg-slate-700 rounded">
        <h2 className="text-xl mb-1">Advanced</h2>
        <p className="text-slate-400 text-sm">
          Configure advanced system settings and preferences.
        </p>
      </div>

      <div className="flex-none mt-4 px-4">
        <div className="flex border-b border-slate-700/50">
          <TabButton
            id="dashboard"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          >
            Dashboard
          </TabButton>
          <TabButton
            id="telemetry"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          >
            Telemetry Inspector
          </TabButton>
        </div>
      </div>

      {activeTab === 'dashboard' && (
        <div className="flex flex-col flex-1 min-h-0 px-4 pt-3 pb-4 gap-3">
          <p className="flex-none text-sm text-slate-400">
            Directly edit the dashboard configuration file and apply changes
          </p>

          <div className="flex flex-col flex-1 min-h-0 rounded border border-slate-600 overflow-hidden">
            <div className="flex items-center justify-between px-3 py-1.5 bg-slate-700/60 border-b border-slate-600">
              <span className="text-xs text-slate-400 font-mono">
                dashboard.json
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={handleImport}
                  className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-600 rounded px-2 py-1 transition-colors cursor-pointer"
                >
                  <UploadSimpleIcon size={13} />
                  Import
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  className="flex items-center gap-1.5 text-xs text-slate-300 hover:text-white hover:bg-slate-600 rounded px-2 py-1 transition-colors cursor-pointer"
                >
                  <DownloadSimpleIcon size={13} />
                  Export
                </button>
                <div className="w-px bg-slate-600 mx-1" />
                <button
                  type="button"
                  onClick={handleSave}
                  className="flex items-center gap-1.5 text-xs text-white bg-slate-600 hover:bg-slate-500 rounded px-3 py-1 transition-colors cursor-pointer font-medium"
                >
                  Save
                </button>
              </div>
            </div>
            <textarea
              className="flex-1 w-full bg-slate-800 p-4 font-mono text-sm focus:outline-none resize-none"
              value={dashboardInput}
              onChange={onInputUpdated}
              placeholder="Dashboard configuration JSON..."
            />
          </div>

          <div className="flex-none flex items-center gap-4 border-t border-slate-700/50 pt-3">
            <span className="text-xs text-slate-500 uppercase tracking-wide">
              Reset
            </span>
            <button
              type="button"
              onClick={handleResetConfigs}
              className="text-xs text-amber-400 hover:text-amber-300 underline underline-offset-2 transition-colors cursor-pointer"
            >
              Widget configs only
            </button>
            <button
              type="button"
              onClick={handleResetCompletely}
              className="text-xs text-red-400 hover:text-red-300 underline underline-offset-2 transition-colors cursor-pointer"
            >
              Everything to factory defaults
            </button>
          </div>
        </div>
      )}

      {activeTab === 'telemetry' && (
        <div className="flex-1 overflow-y-auto min-h-0 px-4 pt-3 pb-4">
          <p className="text-sm text-slate-400 mb-4">
            Debug widget to display raw telemetry and session values
          </p>
          <TelemetryInspectorSettings />
        </div>
      )}
    </div>
  );
};
