import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  DeltaSpeedWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { useDashboard } from '@irdashies/context';
import { TabButton } from '../components/TabButton';
import { SessionVisibility } from '../components/SessionVisibility';
import { SettingsSection } from '../components/SettingSection';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SettingDivider } from '../components/SettingDivider';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingSelectRow } from '../components/SettingSelectRow';

const SETTING_ID = 'deltaspeed';

const defaultConfig = getWidgetDefaultConfig('deltaspeed');

export const DeltaSpeedSettings = () => {
  const { currentDashboard } = useDashboard();

  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as DeltaSpeedWidgetSettings | undefined;

  const [settings, setSettings] = useState<DeltaSpeedWidgetSettings>({
    id: SETTING_ID,
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as DeltaSpeedWidgetSettings['config']) ??
      defaultConfig,
  });

  // useState only reads its initialiser on the first render, and the Loading
  // return below does not re-run it. Mounting before the dashboard has loaded —
  // or switching profile — would otherwise leave this holding defaults, and
  // BaseSettingsSection persists the whole settings object, so the next edit to
  // any one control would write those defaults over the saved config. Re-seed
  // whenever the saved widget changes, using the same guarded
  // set-during-render sync as BaseSettingsSection so there is no stale paint.
  const [prevSaved, setPrevSaved] = useState(savedSettings);
  if (JSON.stringify(savedSettings) !== JSON.stringify(prevSaved)) {
    setPrevSaved(savedSettings);
    if (savedSettings) {
      setSettings({
        id: SETTING_ID,
        enabled: savedSettings.enabled ?? false,
        config:
          (savedSettings.config as DeltaSpeedWidgetSettings['config']) ??
          defaultConfig,
      });
    }
  }

  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () =>
      (localStorage.getItem('deltaSpeedTab') as SettingsTabType) || 'options'
  );

  useEffect(() => {
    localStorage.setItem('deltaSpeedTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) return <>Loading...</>;

  return (
    <BaseSettingsSection
      title="Delta Speed"
      description="Live speed difference against your session best clean lap at this point on track."
      settings={settings as DeltaSpeedWidgetSettings}
      onSettingsChange={(s) => setSettings(s as DeltaSpeedWidgetSettings)}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <div className="space-y-4">
          <div className="flex border-b border-slate-700/50">
            <TabButton
              id="options"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            >
              Options
            </TabButton>
            <TabButton
              id="visibility"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            >
              Visibility
            </TabButton>
          </div>

          <div>
            {activeTab === 'options' && (
              <SettingsSection title="Display">
                <SettingSliderRow
                  title="Background Opacity"
                  description="Opacity of the widget background."
                  value={settings.config.background.opacity}
                  units="%"
                  min={0}
                  max={100}
                  step={5}
                  onChange={(v) =>
                    handleConfigChange({ background: { opacity: v } })
                  }
                />
                <SettingSelectRow
                  title="Units"
                  description="Unit for the numeric readout. Auto follows iRacing's own display units setting."
                  value={settings.config.unit ?? 'km/h'}
                  options={[
                    { label: 'km/h', value: 'km/h' },
                    { label: 'mph', value: 'mph' },
                    { label: 'Auto', value: 'auto' },
                  ]}
                  onChange={(v) => handleConfigChange({ unit: v })}
                />
                <SettingSliderRow
                  title="Full Colour At (km/h)"
                  description="Delta at which the background reaches full colour. Lower values make small differences more visible."
                  value={settings.config.scaleKph ?? 15}
                  units=" km/h"
                  min={5}
                  max={50}
                  step={1}
                  onChange={(v) => handleConfigChange({ scaleKph: v })}
                />
                <SettingSliderRow
                  title="Full Colour At (mph)"
                  description="The same limit used when displaying mph, kept separate so both stay whole numbers."
                  value={settings.config.scaleMph ?? 10}
                  units=" mph"
                  min={3}
                  max={30}
                  step={1}
                  onChange={(v) => handleConfigChange({ scaleMph: v })}
                />
                <SettingSliderRow
                  title="Maximum Shown (km/h)"
                  description="Largest delta shown as a number. Beyond this the readout holds at the limit instead of climbing."
                  value={settings.config.capKph ?? 30}
                  units=" km/h"
                  min={5}
                  max={60}
                  step={1}
                  onChange={(v) => handleConfigChange({ capKph: v })}
                />
                <SettingSliderRow
                  title="Maximum Shown (mph)"
                  description="The same limit used when displaying mph, kept separate so both stay whole numbers."
                  value={settings.config.capMph ?? 20}
                  units=" mph"
                  min={3}
                  max={40}
                  step={1}
                  onChange={(v) => handleConfigChange({ capMph: v })}
                />
                <SettingSliderRow
                  title="Update Threshold (km/h)"
                  description="The number holds still until the delta has moved at least this far. Higher values stop the last digit flickering."
                  value={settings.config.updateThresholdKph ?? 0.3}
                  units=" km/h"
                  min={0}
                  max={2}
                  step={0.1}
                  onChange={(v) =>
                    handleConfigChange({ updateThresholdKph: v })
                  }
                />
                <SettingSliderRow
                  title="Update Threshold (mph)"
                  description="The same threshold used when displaying mph."
                  value={settings.config.updateThresholdMph ?? 0.2}
                  units=" mph"
                  min={0}
                  max={2}
                  step={0.1}
                  onChange={(v) =>
                    handleConfigChange({ updateThresholdMph: v })
                  }
                />
                <SettingToggleRow
                  title="Show number"
                  description="Show the numeric delta inside the box."
                  enabled={settings.config.showNumber ?? true}
                  onToggle={(v) => handleConfigChange({ showNumber: v })}
                />
              </SettingsSection>
            )}

            {activeTab === 'visibility' && (
              <SettingsSection title="Session Visibility">
                <SessionVisibility
                  sessionVisibility={settings.config.sessionVisibility}
                  handleConfigChange={handleConfigChange}
                />

                <SettingDivider />

                <SettingToggleRow
                  title="Show only when on track"
                  description="If enabled, widget will only be shown when driving."
                  enabled={settings.config.showOnlyWhenOnTrack}
                  onToggle={(v) =>
                    handleConfigChange({ showOnlyWhenOnTrack: v })
                  }
                />
              </SettingsSection>
            )}
          </div>
        </div>
      )}
    </BaseSettingsSection>
  );
};
