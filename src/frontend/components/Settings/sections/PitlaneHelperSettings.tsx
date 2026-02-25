import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { ToggleSwitch } from '../components/ToggleSwitch';
import type { PitlaneHelperWidgetSettings, SettingsTabType, TabButtonProps } from '../types';
import { useDashboard } from '@irdashies/context';

const SETTING_ID = 'pitlanehelper';

const defaultConfig: PitlaneHelperWidgetSettings['config'] = {
  showMode: 'approaching',
  approachDistance: 200,
  enablePitLimiterWarning: true,
  enableEarlyPitboxWarning: true,
  earlyPitboxThreshold: 75,
  showPitlaneTraffic: true,
  background: { opacity: 80 },
  progressBarOrientation: 'horizontal',
  showSpeedBar: true,
  showPitExitInputs: false,
  pitExitInputs: {
    throttle: true,
    clutch: true,
  },
  showInputsPhase: 'afterPitbox',
};

export const PitlaneHelperSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as PitlaneHelperWidgetSettings | undefined;

  // Migrate old configs to include new fields
  const migratedConfig = savedSettings?.config
    ? {
        ...defaultConfig,
        ...savedSettings.config,
        progressBarOrientation:
          savedSettings.config.progressBarOrientation ??
          defaultConfig.progressBarOrientation,
        showSpeedBar:
          savedSettings.config.showSpeedBar ?? defaultConfig.showSpeedBar,
        showPitExitInputs:
          savedSettings.config.showPitExitInputs ??
          defaultConfig.showPitExitInputs,
        pitExitInputs:
          savedSettings.config.pitExitInputs ?? defaultConfig.pitExitInputs,
        showInputsPhase:
          savedSettings.config.showInputsPhase ?? defaultConfig.showInputsPhase,
      }
    : defaultConfig;

  const [settings, setSettings] = useState<PitlaneHelperWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: migratedConfig,
  });

  // Tab state with persistence
  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('weatherTab') as SettingsTabType) || 'display'
  );

  useEffect(() => {
    localStorage.setItem('weatherTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <BaseSettingsSection
      title="Pitlane Helper"
      description="Assists with pit entry by showing speed delta, pitbox position, and warnings."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <div className="space-y-4">
          {/* Tabs */}
          <div className="flex border-b border-slate-700/50">
            <TabButton
              id="display"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            >
              Display
            </TabButton>
            <TabButton
              id="options"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            >
              Options
            </TabButton>
          </div>

          <div className="pt-4">
            {/* DISPLAY TAB */}
            {activeTab === 'display' && (
              <div className="space-y-4">
                <h3 className="text-lg font-medium text-slate-200">
                  Visibility
                </h3>

                <div className="space-y-3 pl-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-sm text-slate-300">
                        Show when approaching pit
                      </span>
                      <p className="text-xs text-slate-500">
                        Display overlay before entering pit lane
                      </p>
                    </div>
                    <ToggleSwitch
                      enabled={settings.config.showMode === 'approaching'}
                      onToggle={(enabled) =>
                        handleConfigChange({
                          showMode: enabled ? 'approaching' : 'onPitRoad',
                        })
                      }
                    />
                  </div>

                  {settings.config.showMode === 'approaching' && (
                    <div className="flex items-center justify-between pl-4">
                      <span className="text-sm text-slate-300">
                        Approach Distance
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="100"
                          max="500"
                          step="10"
                          value={settings.config.approachDistance}
                          onChange={(e) =>
                            handleConfigChange({
                              approachDistance: parseInt(e.target.value),
                            })
                          }
                          className="w-24 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="text-xs text-slate-400 w-12">
                          {settings.config.approachDistance}m
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* OPTIONS TAB */}
            {activeTab === 'options' && (
              <div className="space-y-4">
                {/* Warning Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-slate-200">
                    Warnings
                  </h3>
                  <div className="space-y-3 pl-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-slate-300">
                          Pit Limiter Warning
                        </span>
                        <p className="text-xs text-slate-400">
                          Flash warning if entering pit without limiter
                        </p>
                      </div>
                      <ToggleSwitch
                        enabled={settings.config.enablePitLimiterWarning}
                        onToggle={(enabled) =>
                          handleConfigChange({
                            enablePitLimiterWarning: enabled,
                          })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-slate-300">
                          Early Pitbox Warning
                        </span>
                        <p className="text-xs text-slate-400">
                          Alert when pitbox is near pit entry
                        </p>
                      </div>
                      <ToggleSwitch
                        enabled={settings.config.enableEarlyPitboxWarning}
                        onToggle={(enabled) =>
                          handleConfigChange({
                            enableEarlyPitboxWarning: enabled,
                          })
                        }
                      />
                    </div>

                    {settings.config.enableEarlyPitboxWarning && (
                      <div className="flex items-center justify-between pl-4">
                        <span className="text-sm text-slate-300">
                          Early Warning Threshold
                        </span>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min="25"
                            max="300"
                            step="5"
                            value={settings.config.earlyPitboxThreshold}
                            onChange={(e) =>
                              handleConfigChange({
                                earlyPitboxThreshold: parseInt(e.target.value),
                              })
                            }
                            className="w-24 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                          />
                          <span className="text-xs text-slate-400 w-12">
                            {settings.config.earlyPitboxThreshold}m
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Traffic Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-slate-200">
                    Traffic
                  </h3>
                  <div className="space-y-3 pl-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-slate-300">
                          Show Pitlane Traffic
                        </span>
                        <p className="text-xs text-slate-400">
                          Display count of cars ahead/behind in pitlane
                        </p>
                      </div>
                      <ToggleSwitch
                        enabled={settings.config.showPitlaneTraffic}
                        onToggle={(enabled) =>
                          handleConfigChange({ showPitlaneTraffic: enabled })
                        }
                      />
                    </div>
                  </div>
                </div>

                {/* Display Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-slate-200">
                    Display
                  </h3>
                  <div className="space-y-3 pl-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-slate-300">
                          Speed Bar
                        </span>
                        <p className="text-xs text-slate-400">
                          Show vertical bar indicating speed relative to pit
                          limit
                        </p>
                      </div>
                      <ToggleSwitch
                        enabled={settings.config.showSpeedBar}
                        onToggle={(enabled) =>
                          handleConfigChange({ showSpeedBar: enabled })
                        }
                      />
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">
                        Progress Bar Orientation
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() =>
                            handleConfigChange({
                              progressBarOrientation: 'horizontal',
                            })
                          }
                          className={[
                            'px-3 py-1 text-xs font-medium rounded transition-colors',
                            settings.config.progressBarOrientation ===
                            'horizontal'
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
                          ].join(' ')}
                        >
                          Horizontal
                        </button>
                        <button
                          onClick={() =>
                            handleConfigChange({
                              progressBarOrientation: 'vertical',
                            })
                          }
                          className={[
                            'px-3 py-1 text-xs font-medium rounded transition-colors',
                            settings.config.progressBarOrientation ===
                            'vertical'
                              ? 'bg-blue-600 text-white'
                              : 'bg-slate-700 text-slate-300 hover:bg-slate-600',
                          ].join(' ')}
                        >
                          Vertical
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Pit Exit Inputs Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-slate-200">
                    Pit Exit Inputs
                  </h3>
                  <div className="space-y-3 pl-4">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-sm text-slate-300">
                          Show Pit Exit Inputs
                        </span>
                        <p className="text-xs text-slate-400">
                          Display throttle/clutch bars for pit exit
                        </p>
                      </div>
                      <ToggleSwitch
                        enabled={settings.config.showPitExitInputs}
                        onToggle={(enabled) =>
                          handleConfigChange({ showPitExitInputs: enabled })
                        }
                      />
                    </div>

                    {settings.config.showPitExitInputs && (
                      <>
                        <div className="flex items-center justify-between pl-4">
                          <span className="text-sm text-slate-300">
                            Show Throttle
                          </span>
                          <ToggleSwitch
                            enabled={settings.config.pitExitInputs.throttle}
                            onToggle={(enabled) =>
                              handleConfigChange({
                                pitExitInputs: {
                                  ...settings.config.pitExitInputs,
                                  throttle: enabled,
                                },
                              })
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between pl-4">
                          <span className="text-sm text-slate-300">
                            Show Clutch
                          </span>
                          <ToggleSwitch
                            enabled={settings.config.pitExitInputs.clutch}
                            onToggle={(enabled) =>
                              handleConfigChange({
                                pitExitInputs: {
                                  ...settings.config.pitExitInputs,
                                  clutch: enabled,
                                },
                              })
                            }
                          />
                        </div>

                        <div className="flex items-center justify-between pl-4">
                          <span className="text-sm text-slate-300">
                            When to Show
                          </span>
                          <select
                            value={settings.config.showInputsPhase}
                            onChange={(e) =>
                              handleConfigChange({
                                showInputsPhase: e.target.value as
                                  | 'atPitbox'
                                  | 'afterPitbox'
                                  | 'always',
                              })
                            }
                            className="bg-slate-700 text-white text-sm rounded px-2 py-1 border border-slate-600"
                          >
                            <option value="atPitbox">At Pitbox</option>
                            <option value="afterPitbox">After Pitbox</option>
                            <option value="always">Always (on pit road)</option>
                          </select>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Background Settings */}
                <div className="space-y-4">
                  <h3 className="text-lg font-medium text-slate-200">
                    Background
                  </h3>
                  <div className="space-y-3 pl-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-slate-300">
                        Background Opacity
                      </span>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={settings.config.background.opacity}
                          onChange={(e) =>
                            handleConfigChange({
                              background: { opacity: parseInt(e.target.value) },
                            })
                          }
                          className="w-20 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer"
                        />
                        <span className="text-xs text-slate-400 w-8">
                          {settings.config.background.opacity}%
                        </span>
                      </div>
                    </div>
                  </div>
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