import React, { memo, useMemo, useRef, useEffect, useState } from 'react';
import { GantryTabBar } from './components/GantryTabBar/GantryTabBar';
import { GantryStandings } from './components/GantryStandings/GantryStandings';
import { GantryIncidents } from './components/GantryIncidents/GantryIncidents';
import { LapGraphView } from './components/LapGraph/LapGraphView';
import { useRaceControlBridge } from '@irdashies/context';
import { useDriverStandings } from '../Standings/hooks/useDriverStandings';

type GantryView = 'standings-incidents' | 'lap-graph';
type Standings = ReturnType<typeof useDriverStandings>;

/**
 * Calls useDriverStandings() and fires onSnapshot once on first non-empty result,
 * then the parent unmounts this component — tearing down all telemetry subscriptions.
 * To switch to live standings in future, render this unconditionally (no guard).
 */
const StandingsFetcher = memo(
  ({ onSnapshot }: { onSnapshot: (s: Standings) => void }) => {
    const standings = useDriverStandings();
    const onSnapshotRef = useRef(onSnapshot);
    useEffect(() => {
      if (standings.length > 0) onSnapshotRef.current(standings);
    }, [standings]);
    return null;
  }
);
StandingsFetcher.displayName = 'StandingsFetcher';

const GantryInner = memo(() => {
  const [activeView, setActiveView] = useState<GantryView>(
    'standings-incidents'
  );
  const [followedCarIdx, setFollowedCarIdx] = useState<number | null>(null);

  useRaceControlBridge(); // subscribe to incidents on mount

  // Snapshot standings on first non-empty load — StandingsFetcher unmounts after
  // capture, releasing all telemetry subscriptions.
  const [standingsByClass, setStandingsByClass] = useState<Standings>([]);
  const snapshotCaptured = standingsByClass.length > 0;

  const drivers = useMemo(
    () =>
      standingsByClass
        .flatMap(([, classDrivers]) => classDrivers)
        .map((s) => ({
          carIdx: s.carIdx,
          name: s.driver.name,
          carNumber: s.driver.carNum,
        })),
    [standingsByClass]
  );

  return (
    <div className="w-full h-full flex flex-col bg-slate-900/(--bg-opacity) text-white overflow-hidden">
      {!snapshotCaptured && (
        <StandingsFetcher onSnapshot={setStandingsByClass} />
      )}
      <GantryTabBar
        activeView={activeView}
        onViewChange={setActiveView}
        drivers={drivers}
        followedCarIdx={followedCarIdx}
        onFollowChange={setFollowedCarIdx}
      />
      {activeView === 'standings-incidents' && (
        <div className="flex flex-1 overflow-hidden">
          <div className="w-1/2 border-r border-slate-700/50 overflow-hidden">
            <GantryStandings
              standingsByClass={standingsByClass}
              followedCarIdx={followedCarIdx}
            />
          </div>
          <div className="w-1/2 overflow-hidden">
            <GantryIncidents />
          </div>
        </div>
      )}
      {activeView === 'lap-graph' && (
        <div className="flex-1 overflow-hidden">
          <LapGraphView standingsByClass={standingsByClass} />
        </div>
      )}
    </div>
  );
});
GantryInner.displayName = 'Gantry';

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function Gantry(_config?: unknown): React.JSX.Element {
  return <GantryInner />;
}
