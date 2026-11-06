import { useState } from 'react';
import { useDashboard } from '@irdashies/context';
import {
  UploadSimpleIcon,
  DownloadSimpleIcon,
  FolderOpenIcon,
  FileTextIcon,
} from '@phosphor-icons/react';
import { TelemetryInspectorSettings } from './TelemetryInspectorSettings';
import { ChromiumFlagsSettings } from './ChromiumFlagsSettings';
import { TabButton } from '../components/TabButton';
import { SettingsTabType } from '@irdashies/types';
import { ConfirmDialog } from '../components/ConfirmDialog';
import logger from '@irdashies/utils/logger';

export const AdvancedSettings = () => {
  const { currentDashboard, onDashboardUpdated, resetDashboard, bridge } =
    useDashboard();
  const [dashboardInput, setDashboardInput] = useState<string | undefined>(
    JSON.stringify(currentDashboard, undefined, 2)
  );
  const [activeTab, setActiveTab] = useState<SettingsTabType>('dashboard');

  const [resetScope, setResetScope] = useState<'configs' | 'all' | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!currentDashboard || !onDashboardUpdated) {
    return <>Loading...</>;
  }

  const onInputUpdated = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDashboardInput(e.target.value);
    setError(null);
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
      setError('Invalid JSON format. Fix the configuration before saving.');
    }
  };

  const handleExport = async () => {
    if (!dashboardInput) return;
    try {
      const dashboard = JSON.parse(dashboardInput);
      await bridge.exportDashboardToFile(dashboard);
    } catch (e) {
      logger.error('Export failed:', e);
      setError(
        e instanceof SyntaxError
          ? 'Invalid JSON format. Fix the configuration before exporting.'
          : 'Could not export the dashboard. Try again.'
      );
    }
  };

  const handleImport = async () => {
    const imported = await bridge.importDashboardFromFile();
    if (imported) {
      setDashboardInput(JSON.stringify(imported, undefined, 2));
      onDashboardUpdated(imported, { forceReload: true });
    }
  };

  const handleReset = async () => {
    if (!resetScope || pending) return;
    const all = resetScope === 'all';
    setResetScope(null);
    setPending(true);
    setError(null);
    try {
      const result = await resetDashboard(all);
      setDashboardInput(JSON.stringify(result, undefined, 2));
    } catch (e) {
      logger.error('Failed to reset dashboard:', e);
      setError('Failed to reset dashboard. Try again.');
    } finally {
      setPending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-none border-b border-slate-700 px-1 pb-5 pt-1">
        <h2 className="mb-1 text-xl font-semibold tracking-tight text-white">
          Advanced
        </h2>
        <p className="text-slate-400 text-sm">
          Configure advanced system settings and preferences.
        </p>
      </div>

      <div className="flex-none mt-4 px-4">
        <div className="flex flex-wrap gap-1 border-b border-slate-700 pb-1">
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
          <TabButton
            id="chromium"
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          >
            Chromium
          </TabButton>
        </div>
      </div>

      {activeTab === 'dashboard' && (
        <div className="flex flex-col flex-1 min-h-0 px-4 pt-3 pb-4 gap-3">
          <p className="flex-none text-sm text-slate-400">
            Directly edit the dashboard configuration file and apply changes
          </p>

          <div className="flex flex-col flex-1 min-h-0 rounded border border-settings-boundary overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 bg-slate-700/60 border-b border-settings-boundary">
              <span className="text-xs text-slate-400 font-mono">
                dashboard.json
              </span>
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={handleImport}
                  className="settings-button"
                >
                  <UploadSimpleIcon size={13} />
                  Import
                </button>
                <button
                  type="button"
                  onClick={handleExport}
                  className="settings-button"
                >
                  <DownloadSimpleIcon size={13} />
                  Export
                </button>
                <div className="w-px bg-settings-control mx-1" />
                <button
                  type="button"
                  onClick={handleSave}
                  className="settings-button"
                >
                  Save
                </button>
              </div>
            </div>
            <textarea
              aria-label="Dashboard configuration JSON"
              aria-invalid={error?.startsWith('Invalid JSON') ?? false}
              aria-describedby={error ? 'dashboard-json-error' : undefined}
              className="settings-field flex-1 w-full resize-none font-mono"
              value={dashboardInput}
              onChange={onInputUpdated}
              placeholder="Dashboard configuration JSON..."
            />
          </div>

          {error && (
            <p
              id="dashboard-json-error"
              role="alert"
              className="text-sm text-red-300"
            >
              {error}
            </p>
          )}
          <div className="flex-none flex flex-wrap items-center gap-3 border-t border-slate-700/50 pt-3">
            <span className="text-xs text-slate-500 uppercase tracking-wide">
              Logs
            </span>
            <button
              type="button"
              onClick={() => bridge.openLogFolder()}
              className="settings-button"
            >
              <FolderOpenIcon size={13} />
              Open log folder
            </button>
            <button
              type="button"
              onClick={() => bridge.exportLogFile()}
              className="settings-button"
            >
              <FileTextIcon size={13} />
              Export log file
            </button>
          </div>

          <div className="flex-none flex flex-wrap items-center gap-3 border-t border-slate-700/50 pt-3">
            <span className="text-xs text-slate-500 uppercase tracking-wide">
              Reset
            </span>
            <button
              type="button"
              onClick={() => setResetScope('configs')}
              disabled={pending}
              className="settings-button-danger"
            >
              Widget configs only
            </button>
            <button
              type="button"
              onClick={() => setResetScope('all')}
              disabled={pending}
              className="settings-button-danger"
            >
              Everything to factory defaults
            </button>
          </div>
        </div>
      )}

      {activeTab === 'telemetry' && (
        <div className="flex-1 overflow-y-auto min-h-0 px-4 pt-3 pb-4">
          <TelemetryInspectorSettings embedded />
        </div>
      )}

      {activeTab === 'chromium' && (
        <div className="flex-1 min-h-0 pt-3">
          <ChromiumFlagsSettings />
        </div>
      )}
      <ConfirmDialog
        isOpen={resetScope !== null}
        title={
          resetScope === 'all'
            ? 'Reset entire dashboard?'
            : 'Reset widget configurations?'
        }
        message={
          resetScope === 'all'
            ? 'Reset all widget positions, enabled states and configurations to factory defaults.'
            : 'Reset all widget configurations to defaults. Widget positions and enabled states are preserved.'
        }
        confirmText={
          resetScope === 'all' ? 'Reset Everything' : 'Reset Configurations'
        }
        onConfirm={() => void handleReset()}
        onCancel={() => setResetScope(null)}
      />
    </div>
  );
};
