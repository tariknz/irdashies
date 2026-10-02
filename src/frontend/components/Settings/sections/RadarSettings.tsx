import { useEffect, useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { useDashboard } from '@irdashies/context';
import {
  RadarWidgetSettings,
  SettingsTabType,
  getWidgetDefaultConfig,
} from '@irdashies/types';
import { SessionVisibility } from '../components/SessionVisibility';
import { TabButton } from '../components/TabButton';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SettingSelectRow } from '../components/SettingSelectRow';
import { SettingsSection } from '../components/SettingSection';
import { SettingDivider } from '../components/SettingDivider';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { HIGHLIGHT_COLOR_PRESETS } from './GeneralSettings';

const SETTING_ID = 'radar';

const defaultConfig = getWidgetDefaultConfig('radar');

const COLOR_OPTIONS = [
  { label: 'White', value: '16777215' },
  ...Array.from(HIGHLIGHT_COLOR_PRESETS.entries()).map(([value, label]) => ({
    label,
    value: String(value),
  })),
];

const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

const ColorRow = ({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
}) => (
  <div className="flex items-center gap-3">
    <span
      className="rounded border-2 border-slate-600 shrink-0"
      style={{ width: 20, height: 20, backgroundColor: hex(value) }}
    />
    <div className="flex-1">
      <SettingSelectRow
        title={title}
        description={description}
        value={String(value)}
        options={COLOR_OPTIONS}
        onChange={(v) => onChange(parseInt(v, 10))}
      />
    </div>
  </div>
);

export const RadarSettings = () => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as RadarWidgetSettings | undefined;
  const [settings, setSettings] = useState<RadarWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: { ...defaultConfig, ...savedSettings?.config },
  });

  const [activeTab, setActiveTab] = useState<SettingsTabType>(
    () => (localStorage.getItem('radarTab') as SettingsTabType) || 'display'
  );

  useEffect(() => {
    localStorage.setItem('radarTab', activeTab);
  }, [activeTab]);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  const config = settings.config;

  return (
    <BaseSettingsSection
      title="Radar"
      description="A close-range radar centred on your car. The road turns with you, so the cars around you sit where they are on track."
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => (
        <div className="space-y-4">
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
            <TabButton
              id="visibility"
              activeTab={activeTab}
              setActiveTab={setActiveTab}
            >
              Visibility
            </TabButton>
          </div>

          {activeTab === 'display' && (
            <SettingsSection title="Display">
              <SettingSliderRow
                title="Range"
                description="Metres from your car to the edge of the radar."
                value={config.range}
                units="m"
                min={10}
                max={100}
                step={5}
                onChange={(v) => handleConfigChange({ range: v })}
              />
              <SettingSliderRow
                title="Background Opacity"
                value={config.background.opacity}
                units="%"
                min={0}
                max={100}
                step={5}
                onChange={(v) =>
                  handleConfigChange({ background: { opacity: v } })
                }
              />
              <SettingDivider />
              <SettingToggleRow
                title="Show Road"
                description="Draw the track under the cars, turning with your car."
                enabled={config.showTrackMap}
                onToggle={(v) => handleConfigChange({ showTrackMap: v })}
              />
              {config.showTrackMap && (
                <>
                  <SettingSliderRow
                    title="Road Opacity"
                    value={config.mapOpacity}
                    units="%"
                    min={5}
                    max={100}
                    step={5}
                    onChange={(v) => handleConfigChange({ mapOpacity: v })}
                  />
                  <SettingSliderRow
                    title="Road Width"
                    description="The track drawings carry no width, so pick one that looks right."
                    value={config.trackWidth}
                    units="m"
                    min={6}
                    max={25}
                    step={1}
                    onChange={(v) => handleConfigChange({ trackWidth: v })}
                  />
                </>
              )}
              <SettingToggleRow
                title="Distance Rings"
                enabled={config.showRings}
                onToggle={(v) => handleConfigChange({ showRings: v })}
              />
              {config.showRings && (
                <SettingSliderRow
                  title="Ring Spacing"
                  value={config.ringSpacing}
                  units="m"
                  min={5}
                  max={50}
                  step={5}
                  onChange={(v) => handleConfigChange({ ringSpacing: v })}
                />
              )}
              <SettingDivider />
              <SettingToggleRow
                title="Car Numbers"
                enabled={config.showCarNumbers}
                onToggle={(v) => handleConfigChange({ showCarNumbers: v })}
              />
              <SettingSelectRow
                title="Rival Colour"
                description="Colour rivals by their car class, or all the same."
                value={config.rivalColorMode}
                options={[
                  { label: 'Car class', value: 'class' },
                  { label: 'Single colour', value: 'custom' },
                ]}
                onChange={(v) => handleConfigChange({ rivalColorMode: v })}
              />
              {config.rivalColorMode === 'custom' && (
                <ColorRow
                  title="Rival Fill"
                  value={config.rivalColor}
                  onChange={(v) => handleConfigChange({ rivalColor: v })}
                />
              )}
              <ColorRow
                title="Your Car"
                value={config.playerColor}
                onChange={(v) => handleConfigChange({ playerColor: v })}
              />
            </SettingsSection>
          )}

          {activeTab === 'options' && (
            <SettingsSection title="Options">
              <SettingToggleRow
                title="Auto Hide"
                description="Only show the radar while a car is close."
                enabled={config.autoHide}
                onToggle={(v) => handleConfigChange({ autoHide: v })}
              />
              {config.autoHide && (
                <>
                  <SettingSliderRow
                    title="Show Within"
                    description="The radar appears when a car comes this close."
                    value={config.showDistance}
                    units="m"
                    min={5}
                    max={100}
                    step={1}
                    onChange={(v) =>
                      handleConfigChange({
                        showDistance: v,
                        hideDistance: Math.max(config.hideDistance, v),
                      })
                    }
                  />
                  <SettingSliderRow
                    title="Hide Beyond"
                    description="The radar leaves once every car is further than this. Keep it above Show Within so it does not blink."
                    value={config.hideDistance}
                    units="m"
                    min={config.showDistance}
                    max={120}
                    step={1}
                    onChange={(v) => handleConfigChange({ hideDistance: v })}
                  />
                </>
              )}
              <SettingSliderRow
                title="Fade Time"
                value={config.fadeSeconds}
                units="s"
                min={0}
                max={2}
                step={0.1}
                onChange={(v) => handleConfigChange({ fadeSeconds: v })}
              />
              <SettingDivider />
              <SettingSliderRow
                title="Car Length"
                description="iRacing does not report car sizes. 4.5 m suits most GT and touring cars."
                value={config.carLength}
                units="m"
                min={3}
                max={6}
                step={0.1}
                onChange={(v) => handleConfigChange({ carLength: v })}
              />
              <SettingSliderRow
                title="Car Width"
                value={config.carWidth}
                units="m"
                min={1.4}
                max={2.4}
                step={0.1}
                onChange={(v) => handleConfigChange({ carWidth: v })}
              />
              <SettingDivider />
              <SettingToggleRow
                title="Hide Cars Across the Pit Wall"
                description="On track, hide cars on pit road; on pit road, hide cars on track."
                enabled={config.hideInPit}
                onToggle={(v) => handleConfigChange({ hideInPit: v })}
              />
            </SettingsSection>
          )}

          {activeTab === 'visibility' && (
            <SettingsSection title="Session Visibility">
              <SessionVisibility
                sessionVisibility={config.sessionVisibility}
                handleConfigChange={handleConfigChange}
              />
              <SettingDivider />
              <SettingToggleRow
                title="Show only when on track"
                description="Hide the radar while you are not driving."
                enabled={config.showOnlyWhenOnTrack}
                onToggle={(v) => handleConfigChange({ showOnlyWhenOnTrack: v })}
              />
            </SettingsSection>
          )}
        </div>
      )}
    </BaseSettingsSection>
  );
};
