import React, { memo, useMemo, useState, type ReactNode } from 'react';
import { GantryTabBar } from './components/GantryTabBar/GantryTabBar';
import { GantryStandings } from './components/GantryStandings/GantryStandings';
import { GantryIncidents } from './components/GantryIncidents/GantryIncidents';
import { LapGraphView } from './components/LapGraph/LapGraphView';
import {
  GantryPitStops,
  type PitStopsClassFilter,
  type PitStopsMode,
} from './components/GantryPitStops/GantryPitStops';
import { SplitPane } from './components/SplitPane/SplitPane';
import { GantryPanel } from './components/GantryPanel/GantryPanel';
import { useGantryAlwaysOnTop } from './hooks/useGantryAlwaysOnTop';
import { GantryReplayNotice } from './components/GantryReplayBanner/GantryReplayBanner';
import { GantrySessionEndedNotice } from './components/GantrySessionEndedNotice/GantrySessionEndedNotice';
import { useHeld } from './hooks/useGantrySessionHold';
import { GantrySessionDataProvider } from './hooks/useGantrySessionData';
import {
  useActiveSimulator,
  useRaceControlBridge,
  useReplayContextUpdater,
  useRunningState,
  useSessionDrivers,
} from '@irdashies/context';
import type { LapGraphMode } from '@irdashies/domain';
import { simulatorDisplayName, type LapGraphAxisFit } from '@irdashies/types';

type GantryView = 'standings-incidents' | 'lap-graph' | 'pit-stops';

/** Where the standings/incidents divider sits. A UI preference, not config. */
const SPLIT_STORAGE_KEY = 'gantryStandingsSplitPercent';
const DOCK_SPLIT_STORAGE_KEY = 'gantryDockSplitPercent';

const isEmptyRoster = (drivers: readonly unknown[] | undefined) =>
  !drivers || drivers.length === 0;

export interface GantryProps {
  /** Panels shown under the incident feed. The host renders them. */
  dock?: ReactNode;
  /**
   * Replaces the built-in standings table. The host renders it, given the
   * driver the Follow dropdown is on.
   */
  standings?: (followedCarIdx: number | null) => ReactNode;
}

const GantryInner = memo(({ dock, standings }: GantryProps) => {
  const [activeView, setActiveView] = useState<GantryView>(
    'standings-incidents'
  );
  const [followedCarIdx, setFollowedCarIdx] = useState<number | null>(null);
  const [alwaysOnTop, setAlwaysOnTop] = useGantryAlwaysOnTop();

  // The lap graph unmounts when the other tab is showing, so its choices live
  // here. null means "follow the saved setting"; the view decides what that is.
  const [lapGraphClassId, setLapGraphClassId] = useState<string | null>(null);
  const [lapGraphMode, setLapGraphMode] = useState<LapGraphMode | null>(null);
  const [lapGraphAxisFit, setLapGraphAxisFit] =
    useState<LapGraphAxisFit | null>(null);
  const [lapGraphPins, setLapGraphPins] = useState<readonly number[] | null>(
    null
  );
  const [pitClassFilter, setPitClassFilter] =
    useState<PitStopsClassFilter | null>(null);
  const [pitMode, setPitMode] = useState<PitStopsMode>('stops');
  const [pitTeamFilter, setPitTeamFilter] = useState<number | null>(null);

  useReplayContextUpdater();
  useRaceControlBridge(); // subscribe to incidents on mount

  const activeSimulator = useActiveSimulator();
  const { running } = useRunningState();

  // Roster for the follow-driver dropdown — sourced from the session (not
  // standings) so it only changes when drivers join/leave, not every tick.
  // The raw roster includes the pace car and spectators, which the previous
  // standings-derived list excluded; filter them so the dropdown stays to
  // drivers you can actually follow.
  const sessionDrivers = useHeld(useSessionDrivers(), isEmptyRoster);
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
    <div className="w-full h-full flex flex-col bg-settings-page text-white overflow-hidden">
      <GantryTabBar
        activeView={activeView}
        onViewChange={setActiveView}
        connectedSimulator={
          running ? simulatorDisplayName(activeSimulator) : null
        }
        drivers={drivers}
        followedCarIdx={followedCarIdx}
        onFollowChange={setFollowedCarIdx}
        alwaysOnTop={alwaysOnTop}
        onAlwaysOnTopChange={setAlwaysOnTop}
      />
      <GantryReplayNotice />
      <GantrySessionEndedNotice />
      {/* Above the tab switch, so both tabs' data keeps being collected and
          held whichever one is showing. */}
      <GantrySessionDataProvider>
        {activeView === 'standings-incidents' && (
          <div className="flex flex-1 min-h-0 p-3">
            <SplitPane
              label="Standings and incidents split"
              storageKey={SPLIT_STORAGE_KEY}
              left={
                standings ? (
                  <GantryPanel title="Standings" overlayContent>
                    {standings(followedCarIdx)}
                  </GantryPanel>
                ) : (
                  <GantryStandings followedCarIdx={followedCarIdx} />
                )
              }
              right={
                dock ? (
                  <SplitPane
                    orientation="vertical"
                    label="Incidents and docked panels split"
                    storageKey={DOCK_SPLIT_STORAGE_KEY}
                    defaultPercent={60}
                    left={<GantryIncidents />}
                    right={<GantryPanel overlayContent>{dock}</GantryPanel>}
                  />
                ) : (
                  <GantryIncidents />
                )
              }
            />
          </div>
        )}
        {activeView === 'lap-graph' && (
          <div className="flex-1 min-h-0 overflow-hidden p-3">
            <LapGraphView
              followedCarIdx={followedCarIdx}
              selectedClassId={lapGraphClassId}
              onClassChange={setLapGraphClassId}
              chosenMode={lapGraphMode}
              onModeChange={setLapGraphMode}
              chosenAxisFit={lapGraphAxisFit}
              onAxisFitChange={setLapGraphAxisFit}
              chosenPins={lapGraphPins}
              onPinsChange={setLapGraphPins}
            />
          </div>
        )}
        {activeView === 'pit-stops' && (
          <div className="flex-1 overflow-hidden">
            <GantryPitStops
              followedCarIdx={followedCarIdx}
              classFilter={pitClassFilter}
              onClassFilterChange={setPitClassFilter}
              mode={pitMode}
              onModeChange={setPitMode}
              teamFilter={pitTeamFilter}
              onTeamFilterChange={setPitTeamFilter}
            />
          </div>
        )}
      </GantrySessionDataProvider>
    </div>
  );
});
GantryInner.displayName = 'Gantry';

// Also mounted from the widget registry, where it receives the saved config
// as props. Only `dock` and `standings` are read.
export function Gantry({
  dock,
  standings,
}: GantryProps = {}): React.JSX.Element {
  return <GantryInner dock={dock} standings={standings} />;
}
