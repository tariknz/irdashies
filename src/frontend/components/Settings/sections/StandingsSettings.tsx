import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { StandingsWidgetSettings } from '../types';
import { useDashboard } from '@irdashies/context';
import { ToggleSwitch } from '../components/ToggleSwitch';

const SETTING_ID = 'standings';

const defaultConfig: StandingsWidgetSettings['config'] = {
  iRatingChange: { enabled: true },
  badge: { enabled: true },
  delta: { enabled: true },
  lastTime: { enabled: true },
  fastestTime: { enabled: true },
};

// Migration function to handle missing properties in the new config format
const migrateConfig = (savedConfig: unknown): StandingsWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;

  const config = savedConfig as Record<string, unknown>;

  // Handle new format with missing properties
  return {
    iRatingChange: { enabled: (config.iRatingChange as { enabled?: boolean })?.enabled ?? true },
    badge: { enabled: (config.badge as { enabled?: boolean })?.enabled ?? true },
    delta: { enabled: (config.delta as { enabled?: boolean })?.enabled ?? true },
    lastTime: { enabled: (config.lastTime as { enabled?: boolean })?.enabled ?? true },
    fastestTime: { enabled: (config.fastestTime as { enabled?: boolean })?.enabled ?? true },
  };
};

export const StandingsSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(w => w.id === SETTING_ID) as StandingsWidgetSettings | undefined;
  const [settings, setSettings] = useState<StandingsWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: migrateConfig(savedSettings?.config),
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
                  enabled={settings.config.iRatingChange.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({ iRatingChange: { enabled } })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Show Driver Badge</span>
                <ToggleSwitch
                  enabled={settings.config.badge.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({ badge: { enabled } })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Show Delta</span>
                <ToggleSwitch
                  enabled={settings.config.delta.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({ delta: { enabled } })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Show Last Time</span>
                <ToggleSwitch
                  enabled={settings.config.lastTime.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({ lastTime: { enabled } })
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-slate-300">Show Fastest Time</span>
                <ToggleSwitch
                  enabled={settings.config.fastestTime.enabled}
                  onToggle={(enabled) =>
                    handleConfigChange({ fastestTime: { enabled } })
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