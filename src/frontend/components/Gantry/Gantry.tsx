import React, { memo, useMemo, useState } from 'react';
import { GantryTabBar } from './components/GantryTabBar/GantryTabBar';
import { GantryStandings } from './components/GantryStandings/GantryStandings';
import { GantryIncidents } from './components/GantryIncidents/GantryIncidents';
import { LapGraphView } from './components/LapGraph/LapGraphView';
import { useRaceControlBridge, useSessionDrivers } from '@irdashies/context';

type GantryView = 'standings-incidents' | 'lap-graph';

const GantryInner = memo(() => {
  const [activeView, setActiveView] = useState<GantryView>(
    'standings-incidents'
  );
  const [followedCarIdx, setFollowedCarIdx] = useState<number | null>(null);

  useRaceControlBridge(); // subscribe to incidents on mount

  // Roster for the follow-driver dropdown — sourced from the session (not
  // standings) so it only changes when drivers join/leave, not every tick.
  // The raw roster includes the pace car and spectators, which the previous
  // standings-derived list excluded; filter them so the dropdown stays to
  // drivers you can actually follow.
  const sessionDrivers = useSessionDrivers();
  const drivers = useMemo(
    () =>
      (sessionDrivers ?? [])
        .filter((d) => !d.CarIsPaceCar && !d.IsSpectator)
        .map((d) => ({
          carIdx: d.CarIdx,
          name: d.UserName,
          carNumber: d.CarNumber,
        })),
    [sessionDrivers]
  );

  return (
    <div className="w-full h-full flex flex-col bg-slate-900/(--bg-opacity) text-white overflow-hidden">
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
