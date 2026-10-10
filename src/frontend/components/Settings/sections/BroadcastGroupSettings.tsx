import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDashboard } from '@irdashies/context';
import { BroadcastSettings } from './BroadcastSettings';
import { BroadcastTickerSettings } from './BroadcastTickerSettings';
import { BroadcastEventsSettings } from './BroadcastEventsSettings';
import { BroadcastWeatherSettings } from './BroadcastWeatherSettings';
import { ToggleSwitch } from '../components/ToggleSwitch';

/**
 * The broadcast modules stay separate widgets, so each keeps its own place in
 * Edit Layout and its own /widget URL; only their settings share one page.
 * Each tab is a route, so "open settings" on any module lands on its tab.
 */
const MODULES = [
  { type: 'broadcast', label: 'Tower', Section: BroadcastSettings },
  {
    type: 'broadcastticker',
    label: 'Ticker',
    Section: BroadcastTickerSettings,
  },
  {
    type: 'broadcastevents',
    label: 'Events',
    Section: BroadcastEventsSettings,
  },
  {
    type: 'broadcastweather',
    label: 'Weather',
    Section: BroadcastWeatherSettings,
  },
] as const;

type BroadcastModuleType = (typeof MODULES)[number]['type'];
const MODULE_TYPES: readonly string[] = MODULES.map((m) => m.type);

export const BroadcastGroupSettings = ({
  active,
}: {
  active: BroadcastModuleType;
}) => {
  const { currentDashboard, currentProfile, bridge, onDashboardUpdated } =
    useDashboard();
  const [serverPort, setServerPort] = useState(3000);
  useEffect(() => {
    void bridge?.getComponentServerPort?.().then(setServerPort);
  }, [bridge]);
  const obsUrl = `http://localhost:${serverPort}/widget/${active}${
    currentProfile ? `?profile=${currentProfile.id}` : ''
  }`;
  const isEnabled = (type: string) =>
    currentDashboard?.widgets.some(
      (w) => (w.type ?? w.id) === type && w.enabled
    ) ?? false;
  // The master switch turns every module on or off at once; each tab keeps its
  // own switch for running just some of them.
  const anyEnabled = MODULE_TYPES.some(isEnabled);
  const setAllEnabled = (enabled: boolean) => {
    if (!currentDashboard || !onDashboardUpdated) return;
    onDashboardUpdated({
      ...currentDashboard,
      widgets: currentDashboard.widgets.map((w) =>
        MODULE_TYPES.includes(w.type ?? w.id) ? { ...w, enabled } : w
      ),
    });
  };
  const { Section } = MODULES.find((m) => m.type === active) ?? MODULES[0];

  return (
    <div className="flex h-full flex-col">
      <div className="mb-4 flex flex-none items-center justify-between">
        <h2 className="text-xl">Broadcast</h2>
        <ToggleSwitch
          label="All modules"
          enabled={anyEnabled}
          onToggle={setAllEnabled}
        />
      </div>
      <nav className="mb-4 flex flex-none border-b border-slate-700">
        {MODULES.map(({ type, label }) => (
          <Link
            key={type}
            to={`/settings/${type}`}
            className={`flex items-center gap-2 border-b-2 px-4 py-2 transition-colors ${
              type === active
                ? 'border-blue-500 text-white'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <span
              title={isEnabled(type) ? 'On' : 'Off'}
              className={`h-2 w-2 rounded-full ${
                isEnabled(type) ? 'bg-emerald-400' : 'bg-slate-600'
              }`}
            />
            {label}
          </Link>
        ))}
      </nav>
      <p className="mb-4 flex-none text-sm text-slate-400">
        Add each module to OBS as its own Browser Source, so each gets its own
        size and place on the stream:{' '}
        <span className="select-all font-mono text-slate-300">{obsUrl}</span>
      </p>
      <div className="min-h-0 flex-1">
        <Section key={active} />
      </div>
    </div>
  );
};
