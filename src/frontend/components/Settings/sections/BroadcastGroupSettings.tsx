import { useContext, useEffect, useState, type ComponentType } from 'react';
import { useDashboard } from '@irdashies/context';
import { BroadcastSettings } from './BroadcastSettings';
import { BroadcastTickerSettings } from './BroadcastTickerSettings';
import { BroadcastEventsSettings } from './BroadcastEventsSettings';
import { BroadcastWeatherSettings } from './BroadcastWeatherSettings';
import { BroadcastPodiumSettings } from './BroadcastPodiumSettings';
import { BroadcastPreview } from './BroadcastPreview';
import { SettingsPreviewContext } from '@irdashies/domain/widgetPreview/settingsPreviewContext';
import { SettingsPreviewLayout } from '../components/SettingsPreviewLayout';
import {
  broadcastModuleChanged,
  broadcastModuleDefaults,
  isBroadcastModuleType,
  type BroadcastModuleType,
} from '../broadcastModules';

/**
 * The broadcast modules stay separate widgets, so each keeps its own place in
 * Edit Layout and its own /widget URL. Each has a page of its own in the
 * Broadcast menu; the pages share a live preview.
 */
const MODULE_SECTIONS: Record<
  BroadcastModuleType,
  ComponentType<{ obsUrl?: string }>
> = {
  broadcast: BroadcastSettings,
  broadcastticker: BroadcastTickerSettings,
  broadcastevents: BroadcastEventsSettings,
  broadcastweather: BroadcastWeatherSettings,
  broadcastpodium: BroadcastPodiumSettings,
};

export const BroadcastGroupSettings = ({
  active,
}: {
  active: BroadcastModuleType;
}) => {
  const { currentDashboard, currentProfile, bridge, onDashboardUpdated } =
    useDashboard();
  const sharedPreview = useContext(SettingsPreviewContext);
  const [serverPort, setServerPort] = useState(3000);
  useEffect(() => {
    void bridge?.getComponentServerPort?.().then(setServerPort);
  }, [bridge]);
  // Bumped by Reset module: the module's form keeps its own copy of the
  // config, so it is remounted to read the defaults back.
  const [resets, setResets] = useState(0);
  const obsUrl = `http://localhost:${serverPort}/widget/${active}${
    currentProfile ? `?profile=${currentProfile.id}` : ''
  }`;
  const widgetOf = (type: string) =>
    currentDashboard?.widgets.find((w) => (w.type ?? w.id) === type);
  const resetModule = () => {
    if (!currentDashboard || !onDashboardUpdated) return;
    onDashboardUpdated({
      ...currentDashboard,
      widgets: currentDashboard.widgets.map((w) =>
        w.id === active
          ? {
              ...w,
              config: { ...w.config, ...broadcastModuleDefaults(active) },
            }
          : w
      ),
    });
    setResets((n) => n + 1);
  };
  const Section = MODULE_SECTIONS[active];

  const content = (
    <div className="space-y-5">
      <div
        className={`grid items-start gap-5 ${sharedPreview ? '' : 'xl:grid-cols-[minmax(0,1fr)_288px]'}`}
      >
        <div className="min-w-0 space-y-3">
          {broadcastModuleChanged(active, widgetOf(active)?.config) && (
            <div className="flex flex-none justify-end pb-2">
              <button
                type="button"
                className="settings-button"
                onClick={resetModule}
              >
                Reset module
              </button>
            </div>
          )}
          <div className="min-w-0">
            <SettingsPreviewContext value={undefined}>
              <Section key={`${active}-${resets}`} obsUrl={obsUrl} />
            </SettingsPreviewContext>
          </div>
        </div>
        {!sharedPreview && (
          <div className="w-full max-w-72 justify-self-center overflow-hidden rounded-md xl:sticky xl:top-0">
            <BroadcastPreview module={active} />
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div
      className={
        sharedPreview
          ? 'flex h-full min-h-0 flex-col'
          : 'h-full space-y-5 overflow-y-auto pr-1 [scrollbar-gutter:stable]'
      }
    >
      {sharedPreview ? (
        <SettingsPreviewLayout widgetId={sharedPreview}>
          {content}
        </SettingsPreviewLayout>
      ) : (
        content
      )}
    </div>
  );
};

/**
 * The settings page for all five broadcast widgets. One component type for
 * every module, so moving between them in the Broadcast menu updates `active`
 * instead of remounting the page (which reset the detected component-server
 * port and its OBS URL).
 */
export const BroadcastSettingsPage = ({
  widgetType,
}: {
  widgetType?: string;
}) => (
  <BroadcastGroupSettings
    active={isBroadcastModuleType(widgetType) ? widgetType : 'broadcast'}
  />
);
