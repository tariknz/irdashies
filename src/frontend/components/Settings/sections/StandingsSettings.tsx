import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { StandingsWidgetSettings } from '../types';
import { useDashboard } from '@irdashies/context';
import { ToggleSwitch } from '../components/ToggleSwitch';

const SETTING_ID = 'standings';

const defaultConfig: StandingsWidgetSettings['config'] = {
  showIRatingChange: true,
  showBadge: true,
  showDelta: true,
  showLastTime: true,
  showFastestTime: true,
};

export const StandingsSettings = () => {
  const { currentDashboard } = useDashboard();
  const [settings, setSettings] = useState<StandingsWidgetSettings>({
    enabled: currentDashboard?.widgets.find(w => w.id === SETTING_ID)?.enabled ?? false,
    config: currentDashboard?.widgets.find(w => w.id === SETTING_ID)?.config as StandingsWidgetSettings['config'] ?? defaultConfig,
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Standings Settings"
      description="Configure how the standings widget appears and behaves."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <div className="space-y-8">
          {/* Display Settings */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium text-slate-200">Display Settings</h3>
            </div>
            <div className="space-y-3 pl-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Show iRating Changes</span>
                <ToggleSwitch
                  enabled={settings.config.showIRatingChange}
                  onToggle={(enabled) =>
                    handleConfigChange({ showIRatingChange: enabled })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Show Driver Badge</span>
                <ToggleSwitch
                  enabled={settings.config.showBadge}
                  onToggle={(enabled) =>
                    handleConfigChange({ showBadge: enabled })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Show Delta</span>
                <ToggleSwitch
                  enabled={settings.config.showDelta}
                  onToggle={(enabled) =>
                    handleConfigChange({ showDelta: enabled })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Show Last Time</span>
                <ToggleSwitch
                  enabled={settings.config.showLastTime}
                  onToggle={(enabled) =>
                    handleConfigChange({ showLastTime: enabled })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Show Fastest Time</span>
                <ToggleSwitch
                  enabled={settings.config.showFastestTime}
                  onToggle={(enabled) =>
                    handleConfigChange({ showFastestTime: enabled })
                  }
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
}; 