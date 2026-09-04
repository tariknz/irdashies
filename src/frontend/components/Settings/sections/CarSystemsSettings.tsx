import { useState, useEffect } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import {
  CAR_SYSTEM_ADJUSTMENTS,
  CarSystemsWidgetSettings,
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

const SETTING_ID = 'carsystems';

const defaultConfig = getWidgetDefaultConfig('carsystems');

/**
 * Rows offered in settings. `dcPeakBrakeBias` is excluded because it shares the
 * brake bias row — offering both would let a user enable the same row twice.
 */
const SELECTABLE_ROWS = CAR_SYSTEM_ADJUSTMENTS.filter(
  (adjustment) => adjustment.key !== 'dcPeakBrakeBias'
);

export const CarSystemsSettings = () => {
  const { currentDashboard } = useDashboard();

  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as CarSystemsWidgetSettings | undefined;

  const [settings, setSettings] = useState<CarSystemsWidgetSettings>({
    id: SETTING_ID,
    enabled: savedSettings?.enabled ?? false,
    config:
      (savedSettings?.config as CarSystemsWidgetSettings['config']) ??
      defaultConfig,
  });

  // Same guarded set-during-render sync as the other widget settings sections:
  // useState only reads its initialiser once, so mounting before the dashboard
  // has loaded would otherwise persist defaults over the saved config on the
  // next edit.
  const [prevSaved, setPrevSaved] = useState(savedSettings);
  if (JSON.stringify(savedSettings) !== JSON.stringify(prevSaved)) {
    setPrevSaved(savedSettings);
    if (savedSettings) {
      setSettings({
        id: SETTING_ID,
        enabled: savedSettings.enabled ?? false,
        config:
          (savedSettings.config as CarSystemsWidgetSettings['config']) ??
          defaultConfig,
      });
    }
  }

  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () =>
      (localStorage.getItem('carSystemsTab') as SettingsTabType) || 'options'
  );

  useEffect(() => {
    localStorage.setItem('carSystemsTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) return <>Loading...</>;

  const rows = settings.config.rows ?? [];

  /**
   * Rows keep catalogue order rather than the order they were toggled on, so
   * the table reads the same however the user arrived at their selection.
   */
  const toggleRow = (
    key: string,
    enabled: boolean,
    handleConfigChange: (change: Partial<typeof settings.config>) => void
  ) => {
    const next = enabled
      ? SELECTABLE_ROWS.filter(
          (adjustment) =>
            adjustment.key === key || rows.includes(adjustment.key)
        ).map((adjustment) => adjustment.key)
      : rows.filter((row) => row !== key);
    handleConfigChange({ rows: next });
  };

  return (
    <BaseSettingsSection
      title="Car Systems"
      description="Brake bias, ABS, traction control and the other adjustments your car exposes."
      settings={settings as CarSystemsWidgetSettings}
      onSettingsChange={(s) => setSettings(s as CarSystemsWidgetSettings)}
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
              <>
                <SettingsSection title="Display">
                  <SettingSliderRow
                    title="Background Opacity"
                    description="Opacity of the widget background."
                    value={settings.config.background?.opacity ?? 80}
                    units="%"
                    min={0}
                    max={100}
                    step={5}
                    onChange={(v) =>
                      handleConfigChange({ background: { opacity: v } })
                    }
                  />
                  <SettingToggleRow
                    title="Keep rows the car does not have"
                    description="Shows a blank row so each adjustment keeps the same position between cars. Turn off to show only what the current car exposes."
                    enabled={settings.config.showUnsupportedRows ?? true}
                    onToggle={(v) =>
                      handleConfigChange({ showUnsupportedRows: v })
                    }
                  />
                </SettingsSection>

                <SettingsSection title="Rows">
                  {SELECTABLE_ROWS.map((adjustment) => (
                    <SettingToggleRow
                      key={adjustment.key}
                      title={adjustment.label}
                      enabled={rows.includes(adjustment.key)}
                      onToggle={(v) =>
                        toggleRow(adjustment.key, v, handleConfigChange)
                      }
                    />
                  ))}
                </SettingsSection>
              </>
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
