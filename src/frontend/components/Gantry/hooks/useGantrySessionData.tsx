import { createContext, useContext, useMemo, type ReactNode } from 'react';
import type { LapHistorySnapshot, SessionResults } from '@irdashies/types';
import { useDriverStandings } from '@irdashies/domain/standings/useDriverStandings';
import { useQualifyingResults } from '@irdashies/domain/standings/useQualifyingGrid';
import {
  trackStateSelectors,
  useArchivedLapHistory,
  useLapHistorySnapshot,
  useLapTimesStoreUpdater,
  useReplayContextSnapshot,
  useTrackStateSelector,
} from '@irdashies/context';
import { useHeld } from './useGantrySessionHold';

type StandingsByClass = ReturnType<typeof useDriverStandings>;

export interface GantrySessionData {
  standingsByClass: StandingsByClass;
  qualifyingResults: SessionResults[] | undefined;
  /** Live lap history, or the archived session under the replay cursor. */
  history: LapHistorySnapshot | undefined;
  isReplayFile: boolean;
  isArchivedReplay: boolean;
  hasArchivedHistory: boolean;
}

const EMPTY_SESSION_DATA: GantrySessionData = {
  standingsByClass: [],
  qualifyingResults: undefined,
  history: undefined,
  isReplayFile: false,
  isArchivedReplay: false,
  hasArchivedHistory: false,
};

const GantrySessionDataContext =
  createContext<GantrySessionData>(EMPTY_SESSION_DATA);

// Gap and interval are only calculated when the settings say they are
// enabled. The cast is needed because the settings type marks these fields
// required.
const STANDINGS_CONFIG = {
  gap: { enabled: true },
  interval: { enabled: true },
  lapTimeDeltas: { enabled: true, numLaps: 3 },
} as Parameters<typeof useDriverStandings>[0];

const isEmptyStandings = (standings: readonly unknown[]) =>
  standings.length === 0;
const isEmptyResults = (results: SessionResults[] | undefined) =>
  !results || results.length === 0;
const isEmptyHistory = (history: LapHistorySnapshot | undefined) =>
  !history || !history.count.some((count) => count > 0);

/**
 * The session data both Gantry tabs draw from. It sits above the tab switch so
 * it keeps collecting, and keeps holding the finished session, whichever tab
 * is showing.
 */
export const GantrySessionDataProvider = ({
  children,
}: {
  children: ReactNode;
}) => {
  useLapTimesStoreUpdater(true);
  const standingsByClass = useHeld(
    useDriverStandings(STANDINGS_CONFIG, { showAll: true }),
    isEmptyStandings
  );
  const qualifyingResults = useHeld(useQualifyingResults(), isEmptyResults);

  const liveSnapshot = useLapHistorySnapshot();
  const replayContext = useReplayContextSnapshot();
  const cursorSessionNum = useTrackStateSelector(
    trackStateSelectors.sessionNum
  );
  const isReplayFile = replayContext.mode === 'replayFile';
  const isArchivedReplay =
    isReplayFile && replayContext.provenance === 'archived';
  // Recording is paused in a replay file, so an archived replay shows the
  // session under the replay cursor from the archive instead.
  const archivedSnapshot = useArchivedLapHistory(
    isArchivedReplay ? (cursorSessionNum ?? null) : null,
    replayContext.subSessionId
  );

  // Hold the snapshot at an identity that only moves when `version` moves. A
  // resend delivers an equal snapshot as a fresh object, which would otherwise
  // rebuild every series for nothing. Archived history is fetched once per
  // session, so its identity is stable.
  const historyVersion = isReplayFile
    ? archivedSnapshot
    : (liveSnapshot?.version ?? -1);
  const currentHistory = useMemo(
    () => (isReplayFile ? (archivedSnapshot ?? undefined) : liveSnapshot),
    // Deliberately keyed on the version, not the snapshot identity.
    // eslint-disable-next-line @eslint-react/exhaustive-deps
    [isReplayFile, historyVersion]
  );

  // The session the history is for, including which replay. Moving to another
  // one drops what was kept, even when the new one has no laps to show.
  let historySession: string | null = null;
  if (isReplayFile) {
    if (replayContext.subSessionId && cursorSessionNum != null) {
      historySession = `replay:${replayContext.subSessionId}:${cursorSessionNum}`;
    }
  } else if (liveSnapshot?.sessionNum != null) {
    historySession = `live:${liveSnapshot.sessionNum}`;
  }
  const history = useHeld(currentHistory, isEmptyHistory, historySession);

  const hasArchivedHistory = archivedSnapshot !== null;
  const value = useMemo(
    () => ({
      standingsByClass,
      qualifyingResults,
      history,
      isReplayFile,
      isArchivedReplay,
      hasArchivedHistory,
    }),
    [
      standingsByClass,
      qualifyingResults,
      history,
      isReplayFile,
      isArchivedReplay,
      hasArchivedHistory,
    ]
  );

  return (
    <GantrySessionDataContext.Provider value={value}>
      {children}
    </GantrySessionDataContext.Provider>
  );
};

export const useGantrySessionData = (): GantrySessionData =>
  useContext(GantrySessionDataContext);
