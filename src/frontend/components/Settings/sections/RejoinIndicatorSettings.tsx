import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  RejoinIndicatorWidgetSettings,
  SessionVisibilitySettings,
} from '../types';
import { useDashboard } from '@irdashies/context';
import { SessionVisibility } from '../components/SessionVisibility';

const SETTING_ID = 'rejoin';

const defaultConfig: RejoinIndicatorWidgetSettings['config'] = {
  showAtSpeed: 30,
  careGap: 2,
  stopGap: 1,
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
): RejoinIndicatorWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;
  const config = savedConfig as Record<string, unknown>;
  return {
    showAtSpeed: (config.showAtSpeed as number) ?? defaultConfig.showAtSpeed,
    careGap: (config.careGap as number) ?? defaultConfig.careGap,
    stopGap: (config.stopGap as number) ?? defaultConfig.stopGap,
    sessionVisibility:
      (config.sessionVisibility as SessionVisibilitySettings) ??
      defaultConfig.sessionVisibility,
  };
};

export const RejoinIndicatorSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as RejoinIndicatorWidgetSettings | undefined;
  const [settings, setSettings] = useState<RejoinIndicatorWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: migrateConfig(savedSettings?.config),
  });

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<'options' | 'visibility'>(
    () => (localStorage.getItem('rejoinTab') as any) || 'options'
  );

  useEffect(() => {
    localStorage.setItem('rejoinTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Rejoin Indicator"
      description="Configure settings for the Rejoin Indicator. Note: The widget automatically hides while you're in the garage, in a pit stall, or on pit road."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
          <div className="space-y-4">

          {/* Tabs */}
          <div className="flex border-b border-slate-700/50">
            <TabButton id="options" activeTab={activeTab} setActiveTab={setActiveTab}>
              Options
            </TabButton>
            <TabButton id="visibility" activeTab={activeTab} setActiveTab={setActiveTab}>
              Visibility
            </TabButton>
          </div>

          <div className="pt-4">

            {/* DISPLAY TAB */}
            {activeTab === 'options' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-slate-200">Options</h3>   
                <div className="pl-4 space-y-4">  

                <div className="space-y-2">
                  <span className="text-slate-300">Show At Speed</span>
                  <p className="text-xs text-slate-500">
                    Display the rejoin indicator widget when you are at or below this
                    speed
                  </p>
                  <input
                    type="number"
                    value={settings.config.showAtSpeed}
                    onChange={(e) =>
                      handleConfigChange({
                        showAtSpeed: parseFloat(e.target.value),
                      })
                    }
                    className="w-full rounded border-gray-600 bg-gray-700 p-2 text-slate-300"
                    step="0.1"
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-slate-300">Care Gap</span>
                  <p className="text-xs text-slate-500">
                    Distance to the car behind where you need to be cautious when
                    rejoining. Note: the clear status will show when next car is above
                    this gap
                  </p>
                  <input
                    type="number"
                    value={settings.config.careGap}
                    onChange={(e) =>
                      handleConfigChange({
                        careGap: parseFloat(e.target.value),
                      })
                    }
                    className="w-full rounded border-gray-600 bg-gray-700 p-2 text-slate-300"
                    step="0.1"
                  />
                </div>

                <div className="space-y-2">
                  <span className="text-slate-300">Stop Gap</span>
                  <p className="text-xs text-slate-500">
                    Distance to the car behind where it is not safe to rejoin
                  </p>
                  <input
                    type="number"
                    value={settings.config.stopGap}
                    onChange={(e) =>
                      handleConfigChange({
                        stopGap: parseFloat(e.target.value),
                      })
                    }
                    className="w-full rounded border-gray-600 bg-gray-700 p-2 text-slate-300"
                    step="0.1"
                  />
                </div>

              </div>
            </div>
            )}

          {/* VISIBILITY TAB */}
            {activeTab === 'visibility' && (
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
            )}

          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
};

type TabButtonProps = {
  id: 'options' | 'visibility';
  activeTab: string;
  setActiveTab: (tab: any) => void;
  children: React.ReactNode;
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