import { useEffect, useState } from 'react';
import { SIMULATOR_IDS, type ActiveSimulator } from '@irdashies/types';
import { useDashboardBridge } from '../DashboardContext/DashboardContext';

/**
 * The simulator currently feeding telemetry, or null when none has been
 * detected yet. Seeded from the main process because the settings window is
 * usually opened long after the bridge picked one, so waiting for the next
 * change event would leave it blank for the whole session.
 */
export const useActiveSimulator = (): ActiveSimulator | null => {
  const bridge = useDashboardBridge();
  const [simulator, setSimulator] = useState<ActiveSimulator | null>(null);

  useEffect(() => {
    let cancelled = false;
    // True once a change event has arrived. The seeding request is a snapshot
    // of the moment it was made, so once something newer has landed the
    // snapshot is stale and must not overwrite it -- a simulator change while
    // the request is in flight would otherwise leave the header and the widget
    // filtering naming the previous sim until the next event.
    let sawChange = false;

    // Subscribed before the request is made, so a change that lands while it is
    // in flight is seen rather than missed.
    const unsubscribe = bridge?.onSimulatorChanged?.((value) => {
      sawChange = true;
      setSimulator(value);
    });

    void bridge?.getActiveSimulator?.().then((value) => {
      if (!cancelled && !sawChange) setSimulator(value);
    });

    return () => {
      cancelled = true;
      unsubscribe?.();
    };
  }, [bridge]);

  return simulator;
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
