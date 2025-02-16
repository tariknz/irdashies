import { useState } from 'react';
import { DashboardLayout } from '@irdashies/types';

export const SettingsForm = ({
  currentDashboard,
  onDashboardUpdated,
}: {
  currentDashboard: DashboardLayout | undefined;
  onDashboardUpdated: (dashboard: DashboardLayout) => void;
}) => {
  const [dashboardInput, setDashboardInput] = useState<string | undefined>(
    JSON.stringify(currentDashboard, undefined, 2)
  );

  const onInputUpdated = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDashboardInput(e.target.value);
  };

  const save = () => {
    if (!dashboardInput) {
      return;
    }

    try {
      const dashboard = JSON.parse(dashboardInput);
      onDashboardUpdated(dashboard);
    } catch (e) {
      console.error(e);
      // TODO: shitty validation
      alert('Invalid JSON');
    }
  };

  return (
    <div className="bg-slate-700 w-full h-full p-2 flex flex-col gap-2">
      <h1 className="py-2">Settings</h1>
      <textarea
        className="w-full h-full bg-slate-800 p-2 text-monospace text-sm min-h-60"
        value={dashboardInput}
        onChange={(e) => onInputUpdated(e)}
      />
      <div className="flex gap-2">
        <button
          type="button"
          onClick={save}
          className="bg-blue-700 hover:bg-blue-800 rounded-sm text-sm px-2 py-1 w-20"
        >
          Save
        </button>
      </div>
    </div>
  );
};
