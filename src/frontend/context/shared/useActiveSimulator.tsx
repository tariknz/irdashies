import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { SIMULATOR_IDS, type ActiveSimulator } from '@irdashies/types';
import { useDashboardBridge } from '../DashboardContext/DashboardContext';
import { getActiveSimulatorStore } from './ActiveSimulatorStore';

/** Stable no-ops, so a missing bridge does not churn useSyncExternalStore. */
const subscribeToNothing = () => () => undefined;
const noSimulator = (): ActiveSimulator | null => null;

/**
 * The simulator currently feeding telemetry, or null when none has been
 * detected yet. Seeded from the main process because the settings window is
 * usually opened long after the bridge picked one, so waiting for the next
 * change event would leave it blank for the whole session.
 *
 * Backed by one shared subscription per bridge (ActiveSimulatorStore), so it
 * is safe to call anywhere -- including inside a table row rendered once per
 * driver. It used to open a listener and a seeding request per component,
 * which is why callers were made to resolve it once per widget and pass it
 * down. A late mount now reads the cached value on its first render instead
 * of flashing null while its own request is in flight.
 */
export const useActiveSimulator = (): ActiveSimulator | null => {
  const bridge = useDashboardBridge();
  const store = useMemo(
    () => (bridge ? getActiveSimulatorStore(bridge) : undefined),
    [bridge]
  );

  return useSyncExternalStore(
    store?.subscribe ?? subscribeToNothing,
    store?.getSnapshot ?? noSimulator,
    store?.getSnapshot ?? noSimulator
  );
};

/**
 * The simulators this build can actually read, as reported by the sim registry
 * in the main process.
 *
 * Every known simulator is still listed in the settings dropdown; the ones
 * missing from here are shown greyed out. Telling the user a sim exists but
 * this build cannot talk to it is more useful than silently omitting it, which
 * reads as the feature being gone.
 *
 * Starts empty rather than optimistic: presenting a simulator as selectable
 * before the registry has answered lets the user pin a source this build
 * cannot read, and that choice persists and then silently falls back to
 * detection. A dropdown that is briefly inert is the lesser wrong, and the
 * answer arrives in a single IPC round trip.
 *
 * A bridge with no getAvailableSimulators at all is a different case -- there
 * is no answer coming, so every known id is offered rather than leaving the
 * dropdown permanently greyed.
 */
export const useAvailableSimulators = (): ActiveSimulator[] => {
  const bridge = useDashboardBridge();
  const [available, setAvailable] = useState<ActiveSimulator[]>([]);

  useEffect(() => {
    let cancelled = false;
    const request = bridge?.getAvailableSimulators?.();
    if (!request) {
      setAvailable(SIMULATOR_IDS);
      return;
    }
    void request.then((value) => {
      if (!cancelled && value) setAvailable(value);
    });
    return () => {
      cancelled = true;
    };
  }, [bridge]);

  return available;
};
