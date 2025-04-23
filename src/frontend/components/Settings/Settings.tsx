import { useDashboard } from '@irdashies/context';
import { SettingsForm } from './SettingsForm';
import { SettingsLayout } from './SettingsLayout';

export const Settings = () => {
  const { currentDashboard, onDashboardUpdated } = useDashboard();
  if (!currentDashboard || !onDashboardUpdated) {
    return <>Loading...</>;
  }

  return (
    <SettingsLayout />
    // <SettingsForm
    //   currentDashboard={currentDashboard}
    //   onDashboardUpdated={onDashboardUpdated}
    // />
  );
};
