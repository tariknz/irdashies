import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { FlagWidgetSettings, SessionVisibilitySettings } from '../types';
import { useDashboard } from '@irdashies/context';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { SessionVisibility } from '../components/SessionVisibility';

const SETTING_ID = 'flag';

const defaultConfig: FlagWidgetSettings['config'] = {
  enabled: true,
  showOnlyWhenOnTrack: true,
  showLabel: true,
  animate: true,
  blinkPeriod: 0.5,
  matrixMode: '16x16',
  showNoFlagState: true,
  enableGlow: true,
  doubleFlag: false,
  sessionVisibility: {
    race: true,
    loneQualify: true,
    openQualify: true,
    practice: true,
    offlineTesting: true,
  },
};

const migrateConfig = (savedConfig: unknown): FlagWidgetSettings['config'] => {
  if (!savedConfig || typeof savedConfig !== 'object') return defaultConfig;
  const config = savedConfig as Record<string, unknown>;

  return {
    enabled: (config.enabled as boolean) ?? defaultConfig.enabled,
    showOnlyWhenOnTrack:
      (config.showOnlyWhenOnTrack as boolean) ??
      defaultConfig.showOnlyWhenOnTrack,
    showLabel: (config.showLabel as boolean) ?? defaultConfig.showLabel,
    animate: (config.animate as boolean) ?? defaultConfig.animate,
    blinkPeriod: (config.blinkPeriod as number) ?? defaultConfig.blinkPeriod,
    showNoFlagState:
      (config.showNoFlagState as boolean) ?? defaultConfig.showNoFlagState,
    matrixMode:
      (config.matrixMode as '8x8' | '16x16' | 'uniform') ??
      defaultConfig.matrixMode,
    enableGlow: (config.enableGlow as boolean) ?? defaultConfig.enableGlow,
    sessionVisibility:
      (config.sessionVisibility as SessionVisibilitySettings) ??
      defaultConfig.sessionVisibility,
    doubleFlag: (config.doubleFlag as boolean) ?? defaultConfig.doubleFlag,
  };
};

export const FlagSettings = () => {
  const { currentDashboard } = useDashboard();

  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as FlagWidgetSettings | undefined;

  const [settings, setSettings] = useState<FlagWidgetSettings>({
    id: SETTING_ID,
    enabled: savedSettings?.enabled ?? true,
    config: migrateConfig(savedSettings?.config),
  });

  
  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<'display' | 'visibility'>(
    () => (localStorage.getItem('flagTab') as any) || 'display'
  );

  useEffect(() => {
    localStorage.setItem('flagTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) return <>Loading...</>;

  return (
    <BaseSettingsSection
      title="Flag"
      description="Display track flags"
      settings={settings as FlagWidgetSettings}
      onSettingsChange={(s) => setSettings(s as FlagWidgetSettings)}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
      <div className="space-y-4">

          {/* Tabs */}
          <div className="flex border-b border-slate-700/50">
            <TabButton id="display" activeTab={activeTab} setActiveTab={setActiveTab}>
              Display
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

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-md font-medium text-slate-300">
                      Double Flag
                    </h4>
                    <p className="text-xs text-slate-500">
                      When enabled two flags will be displayed
                    </p>
                  </div>
                  <ToggleSwitch
                    enabled={settings.config.doubleFlag ?? false}
                    onToggle={(enabled) =>
                      handleConfigChange({ doubleFlag: enabled })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-md font-medium text-slate-300">
                      Matrix Mode
                    </h4>
                    <p className="text-xs text-slate-500">
                      Choose between 8x8, 16x16, or uniform color rendering.
                    </p>
                  </div>
                  <div>
                    <select
                      className="rounded-md bg-slate-800 text-slate-200 px-3 py-1 text-center"
                      value={settings.config.matrixMode ?? '16x16'}
                      onChange={(e) =>
                        handleConfigChange({
                          matrixMode: e.target.value as '8x8' | '16x16' | 'uniform',
                        })
                      }
                    >
                      <option value="8x8">8x8</option>
                      <option value="16x16">16x16</option>
                      <option value="uniform">Uniform (1x1)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-md font-medium text-slate-300">
                      Animate Flag
                    </h4>
                    <p className="text-xs text-slate-500">
                      When enabled the flag will blink on/off.
                    </p>
                  </div>
                  <ToggleSwitch
                    enabled={settings.config.animate ?? false}
                    onToggle={(enabled) => handleConfigChange({ animate: enabled })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-md font-medium text-slate-300">
                      Blink Period (s)
                    </h4>
                    <p className="text-xs text-slate-500">
                      Set how many seconds between on/off when animation is enabled.
                      Min 0.1s, Max 3s.
                    </p>
                  </div>
                  <input
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="3"
                    className="w-24 rounded-md bg-slate-800 text-slate-200 px-2 py-1 text-right"
                    value={settings.config.blinkPeriod ?? 0.5}
                    disabled={!settings.config.animate}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      if (!Number.isNaN(v)) handleConfigChange({ blinkPeriod: v });
                    }}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-md font-medium text-slate-300">
                      Show Flag Label
                    </h4>
                    <p className="text-xs text-slate-500">
                      Toggle display of the flag name text.
                    </p>
                  </div>
                  <ToggleSwitch
                    enabled={settings.config.showLabel ?? true}
                    onToggle={(enabled) => handleConfigChange({ showLabel: enabled })}
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-md font-medium text-slate-300">
                      Show No Flag State
                    </h4>
                    <p className="text-xs text-slate-500">
                      Display &apos;no flag&apos; (grey leds) when no flags are waved.
                    </p>
                  </div>
                  <ToggleSwitch
                    enabled={settings.config.showNoFlagState ?? true}
                    onToggle={(enabled) =>
                      handleConfigChange({ showNoFlagState: enabled })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-md font-medium text-slate-300">
                      Enable Glow Effect
                    </h4>
                    <p className="text-xs text-slate-500">
                      Add a glow effect around the matrix lights.
                    </p>
                  </div>
                  <ToggleSwitch
                    enabled={settings.config.enableGlow ?? true}
                    onToggle={(enabled) =>
                      handleConfigChange({ enableGlow: enabled })
                    }
                  />
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
                      If enabled, flags will only be shown when driving.
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

type TabButtonProps = {
  id: 'display' | 'visiblity';
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