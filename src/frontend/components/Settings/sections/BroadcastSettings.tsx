import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { SettingsSection } from '../components/SettingSection';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { SessionVisibility } from '../components/SessionVisibility';
import { DriverNamePreview } from '../components/DriverNamePreview';
import { useDashboard } from '@irdashies/context';
import { getWidgetDefaultConfig } from '@irdashies/types';
import type { BroadcastWidgetSettings, NameFormat } from '@irdashies/types';

const SETTING_ID = 'broadcast';

const defaultConfig = getWidgetDefaultConfig('broadcast');

const NAME_FORMATS: readonly NameFormat[] = [
  'name-surname',
  'n.-surname',
  'surname-n.',
  'surname',
];

export const BroadcastSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as BroadcastWidgetSettings | undefined;

  const [settings, setSettings] = useState<BroadcastWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: { ...defaultConfig, ...savedSettings?.config },
  });

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  const { config } = settings;

  return (
    <BaseSettingsSection
      title="Broadcast"
      description="TV-style timing tower that cycles between names, per-class intervals with close battles, and car makes, plus a card for the car on camera. Put it in its own profile and add that profile's /dashboard page to OBS as a Browser Source."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <div className="space-y-4">
          <SettingsSection title="Options">
            <SettingSliderRow
              title="Background Opacity"
              value={config.background.opacity}
              units="%"
              min={0}
              max={100}
              step={1}
              onChange={(v) =>
                handleConfigChange({ background: { opacity: v } })
              }
            />
            <SettingToggleRow
              title="Translucent"
              description="Fade the whole widget, text included, so it hides less of the stream."
              enabled={config.translucent.enabled}
              onToggle={(v) =>
                handleConfigChange({
                  translucent: { ...config.translucent, enabled: v },
                })
              }
            />
            {config.translucent.enabled && (
              <SettingSliderRow
                title="Widget Opacity"
                value={config.translucent.opacity}
                units="%"
                min={20}
                max={100}
                step={5}
                onChange={(v) =>
                  handleConfigChange({
                    translucent: { ...config.translucent, opacity: v },
                  })
                }
              />
            )}
            <SettingSliderRow
              title="Drivers Per Class"
              value={config.driversPerClass}
              min={1}
              max={30}
              step={1}
              onChange={(v) => handleConfigChange({ driversPerClass: v })}
            />
            <SettingSliderRow
              title="Page Time"
              value={config.pageSeconds}
              units="s"
              min={3}
              max={30}
              step={1}
              onChange={(v) => handleConfigChange({ pageSeconds: v })}
            />
            <div className="space-y-2 py-2">
              <label className="text-sm text-slate-300">Title</label>
              <input
                type="text"
                value={config.title}
                placeholder="Track name"
                onChange={(e) => handleConfigChange({ title: e.target.value })}
                className="w-full rounded border-gray-600 bg-gray-700 p-2 text-slate-300"
              />
            </div>
            <SettingToggleRow
              title="Focus Car Card"
              description="Show name, team and lap times of the car the camera is on."
              enabled={config.showFocusCard}
              onToggle={(v) => handleConfigChange({ showFocusCard: v })}
            />
            <SettingToggleRow
              title="Grid and Podium"
              description="Show the starting grid before the race starts and the podium of each class after the checkered flag."
              enabled={config.phaseScreens}
              onToggle={(v) => handleConfigChange({ phaseScreens: v })}
            />
            <div className="py-2">
              <div className="text-sm text-slate-300">Driver Name</div>
              <div className="flex flex-wrap gap-3 justify-end mt-3">
                {NAME_FORMATS.map((format) => (
                  <DriverNamePreview
                    key={format}
                    format={format}
                    selected={config.driverNameFormat === format}
                    onClick={() =>
                      handleConfigChange({ driverNameFormat: format })
                    }
                  />
                ))}
              </div>
            </div>
          </SettingsSection>

          <SettingsSection title="Weather">
            <SettingToggleRow
              title="Weather Card"
              description="Pops up with an animated card when rain starts or stops, the track gets wetter or dries, or track temperature swings by 3 degrees."
              enabled={config.weather.enabled}
              onToggle={(v) =>
                handleConfigChange({
                  weather: { ...config.weather, enabled: v },
                })
              }
            />
            {config.weather.enabled && (
              <>
                <SettingSliderRow
                  title="Also Every (0 = Only On Change)"
                  value={config.weather.intervalMinutes}
                  units="min"
                  min={0}
                  max={30}
                  step={1}
                  onChange={(v) =>
                    handleConfigChange({
                      weather: { ...config.weather, intervalMinutes: v },
                    })
                  }
                />
                <SettingSliderRow
                  title="Show For"
                  value={config.weather.showSeconds}
                  units="s"
                  min={5}
                  max={30}
                  step={1}
                  onChange={(v) =>
                    handleConfigChange({
                      weather: { ...config.weather, showSeconds: v },
                    })
                  }
                />
              </>
            )}
          </SettingsSection>

          <SettingsSection title="Visibility">
            <SessionVisibility
              sessionVisibility={config.sessionVisibility}
              handleConfigChange={handleConfigChange}
            />
          </SettingsSection>
        </div>
      )}
    </BaseSettingsSection>
  );
};
