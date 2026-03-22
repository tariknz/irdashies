import React, { memo, useMemo, useState } from 'react';
import { GantryTabBar } from './components/GantryTabBar/GantryTabBar';
import { GantryStandings } from './components/GantryStandings/GantryStandings';
import { GantryIncidents } from './components/GantryIncidents/GantryIncidents';
import { LapGraphView } from './components/LapGraph/LapGraphView';
import { useRaceControlBridge, LapGapStoreUpdater } from '@irdashies/context';
import { useDriverStandings } from '../Standings/hooks/useDriverStandings';

type GantryView = 'standings-incidents' | 'lap-graph';

const GantryInner = memo(() => {
  const [activeView, setActiveView] = useState<GantryView>(
    'standings-incidents'
  );
  const [followedCarIdx, setFollowedCarIdx] = useState<number | null>(null);

  useRaceControlBridge(); // subscribe to incidents on mount
  // LapGapStoreUpdater watches CarIdxLap and snapshots gap-to-class-leader on each lap completion

  // useDriverStandings returns [classId, Standings[]][] — flatten to get all drivers for tab bar
  const standingsByClass = useDriverStandings();
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
      <LapGapStoreUpdater />
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
            <GantryStandings followedCarIdx={followedCarIdx} />
          </div>
          <div className="w-1/2 overflow-hidden">
            <GantryIncidents />
          </div>
        </div>
      )}
      {activeView === 'lap-graph' && (
        <div className="flex-1 overflow-hidden">
          <LapGraphView />
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
