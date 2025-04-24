import { useState } from 'react';
import { useDashboard } from '@irdashies/context';

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
    <div className="flex flex-col h-full space-y-4">
      <div>
        <h2 className="text-xl mb-4">Advanced Settings</h2>
        <p className="text-slate-400 mb-4">Configure advanced system settings and preferences.</p>
      </div>
      
      <textarea
        className="flex-1 w-full bg-slate-800 p-4 font-mono text-sm rounded border border-slate-600 focus:border-slate-500 focus:outline-none"
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
  );
}; 