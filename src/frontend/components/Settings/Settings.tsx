import { t } from '@irdashies/frontend/i18n';
import { useDashboard } from '@irdashies/context';
import { SettingsLayout } from './SettingsLayout';

export const Settings = () => {
  const { currentDashboard, onDashboardUpdated } = useDashboard();

  if (!currentDashboard || !onDashboardUpdated) {
    // No native title bar: keep a drag handle clear of the window controls.
    return (
      <div
        className="h-10 pr-[124px] [-webkit-app-region:drag]"
        style={{ paddingLeft: 'env(titlebar-area-x, 0px)' }}
      >
        {t('Loading...')}
      </div>
    );
  }

  return <SettingsLayout />;
};
