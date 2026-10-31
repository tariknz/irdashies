import { useDashboard } from '@irdashies/context';
import { SettingsLayout } from './SettingsLayout';

export const Settings = () => {
  const { currentDashboard, onDashboardUpdated } = useDashboard();

  if (!currentDashboard || !onDashboardUpdated) {
    // No native title bar: keep a drag handle clear of the window controls.
    return (
      <div className="h-10 pr-[124px] [-webkit-app-region:drag]">
        Loading...
      </div>
    );
  }

  return <SettingsLayout />;
};
