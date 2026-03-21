import { memo, useState } from 'react';
import { GantryTabBar } from './components/GantryTabBar/GantryTabBar';
import { GantryStandings } from './components/GantryStandings/GantryStandings';
import { GantryIncidents } from './components/GantryIncidents/GantryIncidents';
import { LapGraphView } from './components/LapGraph/LapGraphView';
import { useRaceControlBridge } from '@irdashies/context';
import { useDriverStandings } from '../Standings/hooks/useDriverStandings';

type GantryView = 'standings-incidents' | 'lap-graph';

export const Gantry = memo(() => {
  const [activeView, setActiveView] = useState<GantryView>(
    'standings-incidents'
  );
  const [followedCarIdx, setFollowedCarIdx] = useState<number | null>(null);

  useRaceControlBridge(); // subscribe to incidents on mount

  // useDriverStandings returns [classId, Standings[]][] — flatten to get all drivers for tab bar
  const standingsByClass = useDriverStandings();
  const drivers = standingsByClass
    .flatMap(([, classDrivers]) => classDrivers)
    .map((s) => ({
      carIdx: s.carIdx,
      name: s.driver.name,
      carNumber: s.driver.carNum,
    }));

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
Gantry.displayName = 'Gantry';
