import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard } from '@irdashies/context';
import {
  BlindSpotMonitorWidgetSettings,
  SessionVisibilitySettings,
  SettingsTabType,
  TabButtonProps,
} from '../types';
import { SessionVisibility } from '../components/SessionVisibility';
import { ToggleSwitch } from '../components/ToggleSwitch';

const SETTING_ID = 'blindspotmonitor';

const defaultConfig: BlindSpotMonitorWidgetSettings['config'] = {
  showOnlyWhenOnTrack: true,
  distAhead: 4,
  distBehind: 4,
  background: {
    opacity: 30,
  },
  width: 20,
  sessionVisibility: {
    race: true,
    loneQualify: false,
    openQualify: true,
    practice: true,
    offlineTesting: true,
  },
};

const migrateConfig = (
  savedConfig: unknown
): BlindSpotMonitorWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;

  const config = savedConfig as Record<string, unknown>;
  return {
    showOnlyWhenOnTrack:
      (config.showOnlyWhenOnTrack as boolean) ??
      defaultConfig.showOnlyWhenOnTrack,
    distAhead: (config.distAhead as number) ?? defaultConfig.distAhead,
    distBehind: (config.distBehind as number) ?? defaultConfig.distBehind,
    background: {
      opacity:
        (config.background as { opacity?: number })?.opacity ??
        (defaultConfig.background?.opacity as number),
    },
    width: (config.width as number) ?? defaultConfig.width,
    sessionVisibility:
      (config.sessionVisibility as SessionVisibilitySettings) ??
      defaultConfig.sessionVisibility,
  };
};

export const BlindSpotMonitorSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as BlindSpotMonitorWidgetSettings | undefined;
  const [settings, setSettings] = useState<BlindSpotMonitorWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: migrateConfig(savedSettings?.config),
  });

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('bsmTab') as SettingsTabType) || 'display'
  );

  useEffect(() => {
    localStorage.setItem('bsmTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Blind Spot Monitor"
      description="Configure settings for the blind spot monitor widget that displays visual indicators when cars are detected on your left or right side."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <div className="space-y-4">

          {/* Tabs */}
          <div className="flex border-b border-slate-700/50">
            <TabButton id="display" activeTab={activeTab} setActiveTab={setActiveTab}>
              Display
            </TabButton>
            <TabButton id="options" activeTab={activeTab} setActiveTab={setActiveTab}>
              Options
            </TabButton>
            <TabButton id="visibility" activeTab={activeTab} setActiveTab={setActiveTab}>
              Visibility
            </TabButton>
          </div>

          <div className="pt-4">

            {/* DISPLAY TAB */}
            {activeTab === 'display' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-slate-200">Display</h3>
                <div className="pl-4 space-y-4">

                  {/* Background Opacity */}
                  <div className="space-y-2">
                    <label className="text-slate-300">
                      Background Opacity: {settings.config.background?.opacity ?? 30}%
                    </label>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={settings.config.background?.opacity ?? 30}
                      onChange={(e) =>
                        handleConfigChange({
                          background: { opacity: parseInt(e.target.value) },
                        })
                      }
                      className="w-full"
                    />
                  </div>

                  {/* Width */}
                  <div className="space-y-2">
                    <label className="text-slate-300">
                      Width: {settings.config.width ?? 20}px
                    </label>
                    <input
                      type="range"
                      min="5"
                      max="100"
                      step="1"
                      value={settings.config.width ?? 20}
                      onChange={(e) =>
                        handleConfigChange({ width: parseInt(e.target.value) })
                      }
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500">
                      Width of the blind spot indicator in pixels.
                    </p>
                  </div>

                </div>
              </div>
            )}

            {/* OPTIONS TAB */}
            {activeTab === 'options' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-slate-200">Options</h3>
                <div className="pl-4 space-y-4">

                  {/* Distance Ahead */}
                  <div className="space-y-2">
                    <label className="text-slate-300">
                      Distance Ahead: {settings.config.distAhead}m
                    </label>
                    <input
                      type="range"
                      min="3"
                      max="6"
                      step="0.1"
                      value={settings.config.distAhead}
                      onChange={(e) =>
                        handleConfigChange({ distAhead: parseFloat(e.target.value) })
                      }
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500">
                      Distance to car ahead in meters.
                    </p>
                  </div>

                  {/* Distance Behind */}
                  <div className="space-y-2">
                    <label className="text-slate-300">
                      Distance Behind: {settings.config.distBehind}m
                    </label>
                    <input
                      type="range"
                      min="3"
                      max="6"
                      step="0.1"
                      value={settings.config.distBehind}
                      onChange={(e) =>
                        handleConfigChange({ distBehind: parseFloat(e.target.value) })
                      }
                      className="w-full"
                    />
                    <p className="text-xs text-slate-500">
                      Distance to car behind in meters.
                    </p>
                  </div>

                </div>
              </div>
            )}

            {/* VISIBILITY TAB */}
            {activeTab === 'visibility' && (
              <div className="space-y-4">

                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-slate-200">
                    Session Visibility
                  </h3>
                  <div className="space-y-3 pl-4">
                    <SessionVisibility
                      sessionVisibility={settings.config.sessionVisibility}
                      handleConfigChange={handleConfigChange}
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-slate-700/50 pl-4">
                  <div>
                    <h4 className="text-md font-medium text-slate-300">
                      Show only when on track
                    </h4>
                    <span className="block text-xs text-slate-500">
                      If enabled, blind spotter will only be shown when driving.
                    </span>
                  </div>
                  <ToggleSwitch
                    enabled={settings.config.showOnlyWhenOnTrack}
                    onToggle={(newValue) =>
                      handleConfigChange({
                        showOnlyWhenOnTrack: newValue,
                      })
                    }
                  />
                </div>

              </div>
            )}

          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
};

const TabButton = ({ id, activeTab, setActiveTab, children }: TabButtonProps) => (
  <button
    onClick={() => setActiveTab(id)}
    className={`px-4 py-2 text-sm border-b-2 transition-colors ${
      activeTab === id
        ? 'text-white border-blue-500'
        : 'text-slate-400 border-transparent hover:text-slate-200'
    }`}
  >
    {children}
  </button>
);