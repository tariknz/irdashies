import { useMemo, useState } from 'react';
import type {
  RacePlanBridge,
  RacePlanFetchError,
  RacePlanFetchStatus,
  RacePlanListing,
  RacePlanState,
} from '@irdashies/types';
import { RACE_PLAN_REFRESH_MINUTES } from '@irdashies/types';
import { useRacePlanState } from '@irdashies/context';
import logger from '@irdashies/utils/logger';
import { SettingsSection } from '../components/SettingSection';
import { SettingSelectRow } from '../components/SettingSelectRow';
import { SettingNumberRow } from '../components/SettingNumberRow';
import { SettingActionButton } from '../components/SettingActionButton';

const STATUS_TEXT: Record<RacePlanFetchStatus, string> = {
  idle: 'Not loaded yet',
  ok: 'Up to date',
  unauthorized: 'iRacePlan rejected the API key',
  'not-found': 'iRacePlan has no planning with this ID',
  network: 'Could not reach iRacePlan',
  'invalid-response': 'iRacePlan sent data irDashies could not read',
};

const chooseErrorText = (
  status: RacePlanFetchError,
  planningId: number | null
) =>
  status === 'not-found'
    ? `iRacePlan has no planning with ID ${planningId}. Check the number at the end of the planning's address in iRacePlan.`
    : `${STATUS_TEXT[status]}. The planning was not changed.`;

const INPUT_CLASS =
  'rounded-md bg-slate-900 border border-slate-600 focus:border-accent-500 focus:outline-none text-white px-2 py-1';

const formatTime = (ms: number) =>
  new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString([], {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

const listingLabel = (listing: RacePlanListing) =>
  [
    listing.isTeam ? `${listing.name} (team)` : listing.name,
    listing.trackName,
    listing.car,
    listing.startAt ? formatDate(listing.startAt) : null,
  ]
    .filter(Boolean)
    .join(' · ');

interface RacePlanSettingsProps {
  bridge?: RacePlanBridge;
}

export const RacePlanSettings = ({
  bridge = window.racePlanBridge,
}: RacePlanSettingsProps = {}) => {
  const state = useRacePlanState(bridge);

  if (!bridge) {
    return (
      <div className="px-4 text-sm text-slate-400">
        Race plans are only available in the desktop app.
      </div>
    );
  }
  if (!state) {
    return <div className="px-4 text-sm text-slate-400">Loading...</div>;
  }
  return <RacePlanSettingsContent bridge={bridge} state={state} />;
};

const RacePlanSettingsContent = ({
  bridge,
  state,
}: {
  bridge: RacePlanBridge;
  state: RacePlanState;
}) => {
  const [apiKey, setApiKey] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [planningError, setPlanningError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [listings, setListings] = useState<RacePlanListing[] | null>(null);
  const [manualId, setManualId] = useState('');

  const run = async (action: () => Promise<unknown>, failure: string) => {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err) {
      logger.error(`[RacePlan] ${failure}`, err);
      setError(failure);
    } finally {
      setBusy(false);
    }
  };

  const saveKey = () =>
    run(async () => {
      await bridge.setApiKey(apiKey);
      setApiKey('');
    }, 'Could not save the API key');

  const loadListings = () => {
    setPlanningError(null);
    return run(async () => {
      const result = await bridge.listPlannings();
      if (result.status !== 'ok') {
        setListings(null);
        setPlanningError(STATUS_TEXT[result.status]);
        return;
      }
      setListings(result.plannings);
    }, 'Could not load your plannings');
  };

  /** Resolves true once the planning has loaded and is in use. */
  const choosePlanning = async (planningId: number | null) => {
    setPlanningError(null);
    let chosen = false;
    await run(async () => {
      const result = await bridge.choosePlanning(planningId);
      if (result.status !== 'ok') {
        setPlanningError(chooseErrorText(result.status, planningId));
        return;
      }
      chosen = true;
    }, 'Could not change the planning');
    return chosen;
  };

  const applyManualId = async () => {
    const id = Number(manualId);
    if (!Number.isSafeInteger(id) || id <= 0) {
      setPlanningError('A planning ID is a whole number, e.g. 12345678.');
      return;
    }
    // Keep the typed ID on failure so it can be corrected.
    if (await choosePlanning(id)) setManualId('');
  };

  const { planning, config } = state;
  const strategy = planning?.strategies.find((s) => s.id === state.strategyId);

  const planningOptions = useMemo(() => {
    // Endurance plans are team plans; most recent plannings are solo sprints.
    const options = [...(listings ?? [])]
      .sort((a, b) => Number(b.isTeam) - Number(a.isTeam))
      .map((listing) => ({
        label: listingLabel(listing),
        value: String(listing.id),
      }));
    if (
      config.planningId !== null &&
      !options.some((o) => o.value === String(config.planningId))
    ) {
      options.unshift({
        label: planning?.sessionName ?? `Planning ${config.planningId}`,
        value: String(config.planningId),
      });
    }
    return [{ label: 'None', value: '' }, ...options];
  }, [listings, config.planningId, planning?.sessionName]);

  const stintsPerDriver = useMemo(() => {
    if (!planning || !strategy) return [];
    const counts = new Map<number | null, number>();
    for (const stint of strategy.stints) {
      counts.set(stint.driverId, (counts.get(stint.driverId) ?? 0) + 1);
    }
    return [...counts.entries()].map(([driverId, count]) => ({
      key: driverId ?? 0,
      name:
        driverId === null
          ? 'Unassigned'
          : (planning.drivers.find((d) => d.iracingId === driverId)?.name ??
            `Driver ${driverId}`),
      count,
    }));
  }, [planning, strategy]);

  const statusLine =
    state.status !== 'ok' && planning && state.fetchedAt !== null
      ? `${STATUS_TEXT[state.status]}. Showing the plan saved at ${formatTime(state.fetchedAt)}.`
      : state.status === 'ok' && state.fetchedAt !== null
        ? `Up to date, last loaded at ${formatTime(state.fetchedAt)}.`
        : STATUS_TEXT[state.status];

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto min-h-0 pb-4 space-y-6">
        <p className="text-sm text-slate-400 px-4">
          Show an endurance race plan from iRacePlan in irDashies. These
          settings apply to every profile.
        </p>

        <SettingsSection title="iRacePlan account">
          {!state.canStoreApiKey && (
            <p className="text-sm text-amber-400">
              This PC cannot encrypt the API key, so it cannot be saved.
            </p>
          )}
          {state.hasApiKey ? (
            <SettingActionButton
              title="API key"
              description="Saved and encrypted on this PC."
              label="Clear"
              onClick={() =>
                void run(
                  () => bridge.clearApiKey(),
                  'Could not clear the API key'
                )
              }
            />
          ) : (
            <div className="flex items-center justify-between gap-4">
              <div className="max-w-[60%]">
                <h4 className="text-md font-medium text-slate-300">API key</h4>
                <p className="text-sm text-slate-500 mt-1">
                  Create one in your iRacePlan account settings.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  aria-label="API key"
                  autoComplete="off"
                  className={`${INPUT_CLASS} w-56 font-mono`}
                  value={apiKey}
                  disabled={!state.canStoreApiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
                <button
                  type="button"
                  disabled={busy || !apiKey.trim() || !state.canStoreApiKey}
                  onClick={() => void saveKey()}
                  className="px-3 py-1 text-sm skew-ui settings-heading font-semibold border border-slate-600 hover:border-accent-500 text-slate-300 rounded-md transition-colors disabled:opacity-50"
                >
                  Save
                </button>
              </div>
            </div>
          )}
        </SettingsSection>

        <SettingsSection title="Planning">
          {!state.hasApiKey ? (
            <p className="text-sm text-slate-400">
              Save your API key first to choose a planning.
            </p>
          ) : (
            <>
              <SettingSelectRow
                title="Planning"
                description="The event to follow."
                value={
                  config.planningId === null ? '' : String(config.planningId)
                }
                options={planningOptions}
                onChange={(value) =>
                  void choosePlanning(value === '' ? null : Number(value))
                }
              />
              <SettingActionButton
                title="Find my plannings"
                description="Lists your 100 most recent plannings from iRacePlan."
                label="Load list"
                onClick={() => void loadListings()}
              />
              <div className="flex items-center justify-between gap-4">
                <div className="max-w-[60%]">
                  <h4 className="text-md font-medium text-slate-300">
                    Planning ID
                  </h4>
                  <p className="text-sm text-slate-500 mt-1">
                    The number at the end of the planning&apos;s address in
                    iRacePlan.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    aria-label="Planning ID"
                    className={`${INPUT_CLASS} w-32 font-mono text-right`}
                    value={manualId}
                    onChange={(e) => setManualId(e.target.value.trim())}
                  />
                  <button
                    type="button"
                    disabled={busy || !manualId}
                    onClick={() => void applyManualId()}
                    className="px-3 py-1 text-sm skew-ui settings-heading font-semibold border border-slate-600 hover:border-accent-500 text-slate-300 rounded-md transition-colors disabled:opacity-50"
                  >
                    {busy ? 'Checking...' : 'Use'}
                  </button>
                </div>
              </div>
              {planningError && (
                <p role="alert" className="text-sm text-red-400">
                  {planningError}
                </p>
              )}
            </>
          )}
          {planning && (
            <SettingSelectRow
              title="Strategy"
              value={String(state.strategyId ?? '')}
              options={planning.strategies.map((s) => ({
                label: s.name,
                value: String(s.id),
              }))}
              onChange={(value) =>
                void run(
                  () => bridge.setConfig({ strategyId: Number(value) }),
                  'Could not change the strategy'
                )
              }
            />
          )}
        </SettingsSection>

        <SettingsSection title="Updates">
          <SettingNumberRow
            title="Refresh every"
            description="Changes made in iRacePlan show up after the next refresh."
            value={config.refreshMinutes}
            min={RACE_PLAN_REFRESH_MINUTES.min}
            max={RACE_PLAN_REFRESH_MINUTES.max}
            units="min"
            onChange={(minutes) => {
              const refreshMinutes = Math.round(minutes);
              if (
                refreshMinutes < RACE_PLAN_REFRESH_MINUTES.min ||
                refreshMinutes > RACE_PLAN_REFRESH_MINUTES.max
              )
                return;
              void run(
                () => bridge.setConfig({ refreshMinutes }),
                'Could not change the refresh interval'
              );
            }}
          />
          <SettingActionButton
            title="Status"
            description={statusLine}
            label="Refresh now"
            onClick={() =>
              void run(() => bridge.refreshNow(), 'Could not refresh the plan')
            }
          />
          {error && <p className="text-sm text-red-400">{error}</p>}
        </SettingsSection>

        {planning && strategy && (
          <SettingsSection title="Summary">
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
              <dt className="text-slate-500">Event</dt>
              <dd className="text-slate-300">{planning.sessionName}</dd>
              {planning.trackName && (
                <>
                  <dt className="text-slate-500">Track</dt>
                  <dd className="text-slate-300">{planning.trackName}</dd>
                </>
              )}
              {planning.car && (
                <>
                  <dt className="text-slate-500">Car</dt>
                  <dd className="text-slate-300">{planning.car}</dd>
                </>
              )}
              <dt className="text-slate-500">Race start</dt>
              <dd className="text-slate-300">
                {formatDate(new Date(strategy.raceStartMs).toISOString())}{' '}
                {formatTime(strategy.raceStartMs)}
              </dd>
              <dt className="text-slate-500">Stints</dt>
              <dd className="text-slate-300">{strategy.stints.length}</dd>
            </dl>
            <ul className="text-sm space-y-1">
              {stintsPerDriver.map((driver) => (
                <li key={driver.key} className="flex justify-between">
                  <span className="text-slate-300">{driver.name}</span>
                  <span className="text-slate-500">
                    {driver.count} {driver.count === 1 ? 'stint' : 'stints'}
                  </span>
                </li>
              ))}
            </ul>
          </SettingsSection>
        )}
      </div>
    </div>
  );
};
