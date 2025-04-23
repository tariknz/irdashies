import { useState } from 'react';
import { SettingsForm } from '../SettingsForm';
import { useDashboard } from '@irdashies/context';
import { DashboardLayout } from '@irdashies/types';

export const AdvancedSettings = () => {
  const { currentDashboard, onDashboardUpdated } = useDashboard();
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
      onDashboardUpdated(dashboard);
    } catch (e) {
      console.error(e);
      alert('Invalid JSON format');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl mb-4">Advanced Settings</h2>
        <p className="text-slate-400 mb-4">Configure advanced system settings and preferences.</p>
      </div>
      
      <textarea
        className="w-full bg-slate-800 p-4 font-mono text-sm min-h-60 rounded"
        value={dashboardInput}
        onChange={onInputUpdated}
        placeholder="Dashboard configuration JSON..."
      />
      
      <div>
        <button
          type="button"
          onClick={handleSave}
          className="bg-blue-700 hover:bg-blue-800 rounded-xs text-sm px-4 py-2 w-20"
        >
          Save
        </button>
      </div>
    </div>
  );
}; 