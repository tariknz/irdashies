import { useState } from 'react';
import { BaseSettingsSection } from '../components/BaseSettingsSection';
import { BroadcastModuleDescription } from './BroadcastModuleDescription';
import { changeMarker } from '../components/ChangedMark';
import { SettingsSection } from '../components/SettingSection';
import { SettingSliderRow } from '../components/SettingSliderRow';
import { SessionVisibility } from '../components/SessionVisibility';
import { TabButton } from '../components/TabButton';
import { useStoredTab } from '../hooks/useStoredTab';
import { useDashboard } from '@irdashies/context';
import { getWidgetDefaultConfig } from '@irdashies/types';
import type { BroadcastWeatherWidgetSettings } from '@irdashies/types';

const SETTING_ID = 'broadcastweather';

const defaultConfig = getWidgetDefaultConfig('broadcastweather');

type ModuleTab = 'options' | 'visibility';

const TABS: { id: ModuleTab; label: string }[] = [
  { id: 'options', label: 'Options' },
  { id: 'visibility', label: 'Visibility' },
];

const TAB_IDS = TABS.map((tab) => tab.id);

export const BroadcastWeatherSettings = ({ obsUrl }: { obsUrl?: string }) => {
  const { currentDashboard } = useDashboard();
  const savedSettings = currentDashboard?.widgets.find(
    (w) => w.id === SETTING_ID
  ) as BroadcastWeatherWidgetSettings | undefined;

  const [settings, setSettings] = useState<BroadcastWeatherWidgetSettings>({
    enabled: savedSettings?.enabled ?? false,
    config: { ...defaultConfig, ...savedSettings?.config },
  });
  const [tab, setTab] = useStoredTab(`${SETTING_ID}Tab`, TAB_IDS);

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  const { config } = settings;

  return (
    <BaseSettingsSection
      disableInternalScroll
      title="Broadcast Weather"
      description={
        <BroadcastModuleDescription obsUrl={obsUrl}>
          Pops up with an animated card when rain starts or stops, the track
          gets wetter or dries, or track temperature swings by 3 degrees.
        </BroadcastModuleDescription>
      }
      settings={settings}
      onSettingsChange={setSettings}
      widgetId={SETTING_ID}
    >
      {(handleConfigChange) => {
        const mark = changeMarker(config, defaultConfig, handleConfigChange);
        return (
          <div className="space-y-4">
            <div className="flex flex-wrap gap-1 border-b border-slate-700 pb-1">
              {TABS.map(({ id, label }) => (
                <TabButton
                  key={id}
                  id={id}
                  activeTab={tab}
                  setActiveTab={setTab}
                >
                  {label}
                </TabButton>
              ))}
            </div>

            {tab === 'options' && (
              <SettingsSection title="Display" scaleWidgetId={SETTING_ID}>
                {mark(
                  ['background'],
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
                )}
                {mark(
                  ['intervalMinutes'],
                  <SettingSliderRow
                    title="Also Every (0 = Only On Change)"
                    value={config.intervalMinutes}
                    units="min"
                    min={0}
                    max={30}
                    step={1}
                    onChange={(v) => handleConfigChange({ intervalMinutes: v })}
                  />
                )}
                {mark(
                  ['showSeconds'],
                  <SettingSliderRow
                    title="Show For"
                    value={config.showSeconds}
                    units="s"
                    min={5}
                    max={30}
                    step={1}
                    onChange={(v) => handleConfigChange({ showSeconds: v })}
                  />
                )}
              </SettingsSection>
            )}

            {tab === 'visibility' && (
              <SettingsSection title="Visibility">
                {mark(
                  ['sessionVisibility'],
                  <SessionVisibility
                    sessionVisibility={config.sessionVisibility}
                    handleConfigChange={handleConfigChange}
                  />
                )}
              </SettingsSection>
            )}
          </div>
        );
      }}
    </BaseSettingsSection>
  );
};
