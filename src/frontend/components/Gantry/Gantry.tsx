import React, { memo, useMemo, useState } from 'react';
import { GantryTabBar } from './components/GantryTabBar/GantryTabBar';
import { GantryStandings } from './components/GantryStandings/GantryStandings';
import { GantryIncidents } from './components/GantryIncidents/GantryIncidents';
import { LapGraphView } from './components/LapGraph/LapGraphView';
import { SplitPane } from './components/SplitPane/SplitPane';
import { useRaceControlBridge, useSessionDrivers } from '@irdashies/context';
import type { LapGraphMode } from '@irdashies/domain';

type GantryView = 'standings-incidents' | 'lap-graph';

/** Where the standings/incidents divider sits. A UI preference, not config. */
const SPLIT_STORAGE_KEY = 'gantryStandingsSplitPercent';

const GantryInner = memo(() => {
  const [activeView, setActiveView] = useState<GantryView>(
    'standings-incidents'
  );
  const [followedCarIdx, setFollowedCarIdx] = useState<number | null>(null);

  // The lap graph unmounts when the other tab is showing, so its choices live
  // here. null means "follow the saved setting"; the view decides what that is.
  const [lapGraphClassId, setLapGraphClassId] = useState<string | null>(null);
  const [lapGraphMode, setLapGraphMode] = useState<LapGraphMode | null>(null);
  const [lapGraphPins, setLapGraphPins] = useState<readonly number[] | null>(
    null
  );

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
        <SplitPane
          label="Standings and incidents split"
          storageKey={SPLIT_STORAGE_KEY}
          left={<GantryStandings followedCarIdx={followedCarIdx} />}
          right={<GantryIncidents />}
        />
      )}
      {activeView === 'lap-graph' && (
        <div className="flex-1 overflow-hidden">
          <LapGraphView
            followedCarIdx={followedCarIdx}
            selectedClassId={lapGraphClassId}
            onClassChange={setLapGraphClassId}
            chosenMode={lapGraphMode}
            onModeChange={setLapGraphMode}
            chosenPins={lapGraphPins}
            onPinsChange={setLapGraphPins}
          />
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
