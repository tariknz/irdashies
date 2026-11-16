import { useContext, useEffect, useState, type ComponentType } from 'react';
import { useDashboard } from '@irdashies/context';
import { BroadcastSettings } from './BroadcastSettings';
import { BroadcastTickerSettings } from './BroadcastTickerSettings';
import { BroadcastEventsSettings } from './BroadcastEventsSettings';
import { BroadcastWeatherSettings } from './BroadcastWeatherSettings';
import { BroadcastPodiumSettings } from './BroadcastPodiumSettings';
import { SettingSelectRow } from '../components/SettingSelectRow';
import type { BroadcastTransition } from '@irdashies/types';
import { ToggleSwitch } from '../components/ToggleSwitch';
import { BroadcastPreview } from './BroadcastPreview';
import { SettingsPreviewContext } from '@irdashies/domain/widgetPreview/settingsPreviewContext';
import { SettingsPreviewLayout } from '../components/SettingsPreviewLayout';
import {
  BROADCAST_MODULE_TYPES,
  broadcastModuleChanged,
  broadcastModuleDefaults,
  isBroadcastModuleType,
  type BroadcastModuleType,
} from '../broadcastModules';

/**
 * The broadcast modules stay separate widgets, so each keeps its own place in
 * Edit Layout and its own /widget URL. Each has a page of its own in the
 * Broadcast menu; the pages share the transition, the OBS hint and a live
 * preview.
 */
const MODULE_SECTIONS: Record<BroadcastModuleType, ComponentType> = {
  broadcast: BroadcastSettings,
  broadcastticker: BroadcastTickerSettings,
  broadcastevents: BroadcastEventsSettings,
  broadcastweather: BroadcastWeatherSettings,
  broadcastpodium: BroadcastPodiumSettings,
};

const TRANSITION_OPTIONS: { label: string; value: BroadcastTransition }[] = [
  { label: 'Random', value: 'random' },
  { label: 'Slide Left', value: 'slide-left' },
  { label: 'Slide Right', value: 'slide-right' },
  { label: 'Slide Up', value: 'slide-up' },
  { label: 'Fade', value: 'fade-in' },
  { label: 'Flip', value: 'flip' },
  { label: 'Wipe', value: 'wipe' },
  { label: 'Zoom', value: 'zoom' },
  { label: 'Checker', value: 'checker' },
];

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
  const isEnabled = (type: string) => widgetOf(type)?.enabled ?? false;
  const updateWidgets = (
    change: (w: NonNullable<ReturnType<typeof widgetOf>>) => typeof w
  ) => {
    if (!currentDashboard || !onDashboardUpdated) return;
    onDashboardUpdated({
      ...currentDashboard,
      widgets: currentDashboard.widgets.map(change),
    });
  };
  // The master switch turns every module on or off at once; each module keeps
  // its own switch for running just some of them.
  const anyEnabled = BROADCAST_MODULE_TYPES.some(isEnabled);
  const setAllEnabled = (enabled: boolean) =>
    updateWidgets((w) =>
      isBroadcastModuleType(w.type ?? w.id) ? { ...w, enabled } : w
    );
  // One transition for every module. It is kept in the tower config, where it
  // started out, so saved dashboards need no migration.
  const transition =
    (widgetOf('broadcast')?.config?.pageTransition as
      BroadcastTransition | undefined) ?? 'random';
  const setTransition = (pageTransition: BroadcastTransition) =>
    updateWidgets((w) =>
      w.id === 'broadcast'
        ? { ...w, config: { ...w.config, pageTransition } }
        : w
    );
  const resetModule = () => {
    updateWidgets((w) =>
      w.id === active
        ? { ...w, config: { ...w.config, ...broadcastModuleDefaults(active) } }
        : w
    );
    setResets((n) => n + 1);
  };
  const Section = MODULE_SECTIONS[active];

  const content = (
    <div className="space-y-5">
      <div className="relative mb-2 flex-none pl-4">
        {transition !== 'random' && (
          <button
            type="button"
            title="Changed: click to reset"
            aria-label="Reset transition"
            className="absolute -left-2 -top-0.5 flex h-6 w-6 items-center justify-center rounded group"
            onClick={() => setTransition('random')}
          >
            <span className="h-2 w-2 rounded-full bg-accent-400 group-hover:bg-accent-300" />
          </button>
        )}
        <SettingSelectRow<BroadcastTransition>
          title="Transition"
          description="How every module animates: tower page changes, ticker views, and events, weather and podium cards popping up. Random never uses the same one twice in a row."
          value={transition}
          options={TRANSITION_OPTIONS}
          onChange={setTransition}
        />
      </div>
      <p className="mb-4 flex-none border-b border-slate-700/50 pb-4 text-sm text-slate-400">
        Add each module to OBS as its own Browser Source, so each gets its own
        size and place on the stream:{' '}
        <span className="select-all font-mono text-slate-300">{obsUrl}</span>
      </p>
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
            <Section key={`${active}-${resets}`} />
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
      <div className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-700 pb-5 pt-1">
        <h2 className="text-xl font-semibold tracking-tight text-white">
          Broadcast
        </h2>
        <ToggleSwitch
          label="All modules"
          enabled={anyEnabled}
          onToggle={setAllEnabled}
        />
      </div>
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
