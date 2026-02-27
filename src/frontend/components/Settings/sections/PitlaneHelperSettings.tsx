import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { TabButton } from '../components/TabButton';
import type { PitlaneHelperWidgetSettings, SettingsTabType } from '../types';
import { useDashboard } from '@irdashies/context';
import { SettingsSection } from '../components/SettingSection';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingButtonGroupRow } from '../components/SettingButtonGroupRow';
import { SettingSelectRow } from '../components/SettingSelectRow';

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
    () => (localStorage.getItem('pitLaneTab') as SettingsTabType) || 'options'
  );

  useEffect(() => {
    localStorage.setItem('pitLaneTab', activeTab);
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
              id="options"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            >
              Options
            </TabButton>
          </div>

          <div className="pt-4 space-y-4">

            {/* OPTIONS TAB */}
            {activeTab === 'options' && (
              <>
              <SettingsSection title="Visibility">
              
                <SettingToggleRow
                    title="Show when approaching pit"
                    description="Display overlay before entering pit lane"
                    enabled={settings.config.showMode === 'approaching'}
                    onToggle={(enabled) =>
                      handleConfigChange({ showMode: enabled ? 'approaching' : 'onPitRoad' })
                    }
                  />

                  {settings.config.showMode === 'approaching' && (
                    <SettingSliderRow
                      title="Approach Distance"
                      description="Size of the circle for other drivers (matches curved track map scale)"
                      value={settings.config.approachDistance}
                      units="m"
                      min={100}
                      max={500}
                      step={10}
                      onChange={(v) =>
                        handleConfigChange({ approachDistance: v })
                      }
                    />
                  )}

              </SettingsSection>      
      
              {/* Warning Settings */}
              <SettingsSection title="Warnings">
            
                <SettingToggleRow
                  title="Pit Limiter Warning"
                  description="Flash warning if entering pit without limiter"
                  enabled={settings.config.enablePitLimiterWarning}
                  onToggle={(enabled) =>
                    handleConfigChange({ enablePitLimiterWarning: enabled })
                  }
                />

                <SettingToggleRow
                  title="Early Pitbox Warning"
                  description="Alert when pitbox is near pit entry"
                  enabled={settings.config.enableEarlyPitboxWarning}
                  onToggle={(enabled) =>
                    handleConfigChange({ enableEarlyPitboxWarning: enabled })
                  }
                />

                {settings.config.enableEarlyPitboxWarning && (
                  <SettingSliderRow
                    title="Early Warning Threshold"
                    description="Distance from pitbox to trigger warning (meters)"
                    value={settings.config.earlyPitboxThreshold}
                    units="m"
                    min={25}
                    max={300}
                    step={10}
                    onChange={(v) =>
                      handleConfigChange({ earlyPitboxThreshold: v })
                    }
                  />
                )}

              </SettingsSection>    

              {/* Display Settings */}
              <SettingsSection title="Display">  

                 <SettingToggleRow
                  title="Show Pitlane Traffic"
                  description="Display count of cars ahead/behind in pitlane"
                  enabled={settings.config.showPitlaneTraffic}
                  onToggle={(newValue) =>
                    handleConfigChange({ showPitlaneTraffic: newValue })
                  }
                />

                 <SettingToggleRow
                  title="Speed Bar"
                  description="Show vertical bar indicating speed relative to pit limit"
                  enabled={settings.config.showSpeedBar}
                  onToggle={(newValue) =>
                    handleConfigChange({ showSpeedBar: newValue })
                  }
                /> 

                <SettingButtonGroupRow<'horizontal' | 'vertical'>
                  title="Progress Bar Orientation"
                  value={settings.config.progressBarOrientation ?? 'horizontal'}
                  options={[
                    { label: 'Horizontal', value: 'horizontal' },
                    { label: 'Vertical', value: 'vertical' },
                  ]}
                  onChange={(v) => handleConfigChange({ progressBarOrientation: v })}
                />    

                <SettingSliderRow
                  title="Background Opacity"
                  value={settings.config.background.opacity ?? 40}
                  units="%"
                  min={0}
                  max={100}
                  step={1}
                  onChange={(v) =>
                    handleConfigChange({ background: { opacity: v } })
                  }
                />

              </SettingsSection>    
  
              {/* Pit Exit Inputs Settings */}
              <SettingsSection title="Pit Exit Inputs">  

                <SettingToggleRow
                  title="Show Pit Exit Inputs"
                  description="Display throttle/clutch bars for pit exit"
                  enabled={settings.config.showPitExitInputs}
                  onToggle={(newValue) =>
                    handleConfigChange({ showPitExitInputs: newValue })
                  }
                /> 

                {settings.config.showPitExitInputs && (
                    <>
                    <SettingToggleRow
                      title="Show Throttle"
                      enabled={settings.config.pitExitInputs.throttle}
                      onToggle={(newValue) =>
                        handleConfigChange({ pitExitInputs: { ...settings.config.pitExitInputs, throttle: newValue } })
                      }
                    /> 
                    <SettingToggleRow
                      title="Show Clutch"                      
                      enabled={settings.config.pitExitInputs.clutch}
                      onToggle={(newValue) =>
                        handleConfigChange({ pitExitInputs: { ...settings.config.pitExitInputs, clutch: newValue } })
                      }
                    /> 
                    <SettingSelectRow<'atPitbox' | 'afterPitbox' | 'always'>
                      title="When to Show"
                      value={settings.config.showInputsPhase ?? 'atPitbox'}
                      options={[
                        { label: 'At Pitbox', value: 'atPitbox' },
                        { label: 'After Pitbox', value: 'afterPitbox' },
                        { label: 'Always (on pit road)', value: 'always' },
                      ]}
                      onChange={(v) => handleConfigChange({ showInputsPhase: v })}
                    />                    
                    </>
                )}

              </SettingsSection>    

              </>
            )}

          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
};