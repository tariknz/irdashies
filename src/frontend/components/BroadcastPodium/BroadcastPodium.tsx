import { useDashboard, useSessionTimeTiming } from '@irdashies/context';
import { useDriverStandings } from '@irdashies/domain/standings/useDriverStandings';
import type { StandingsWidgetSettings } from '@irdashies/types';
import { racePhase } from '../Broadcast/broadcastRows';
import { BroadcastEnter } from '../Broadcast/BroadcastEnter';
import { useBroadcastPodiumSettings } from './hooks/useBroadcastPodiumSettings';
import { PodiumCard } from './PodiumCard';

// The gap to the winner is shown under each driver.
const STANDINGS_OPTIONS = {
  gap: { enabled: true },
} as StandingsWidgetSettings['config'];

/**
 * The podium of each class, up after the checkered flag of a race. Demo mode
 * shows it too, so it can be placed in Edit Layout and OBS.
 */
export const BroadcastPodium = () => {
  const { isDemoMode } = useDashboard();
  const settings = useBroadcastPodiumSettings();
  const { sessionType, state } = useSessionTimeTiming();
  const groups = useDriverStandings(STANDINGS_OPTIONS, { showAll: true });

  if (!isDemoMode && racePhase(sessionType, state) !== 'podium') return null;
  if (groups.length === 0) return null;

  return (
    <BroadcastEnter
      id="podium"
      className="w-full text-sm"
      style={{
        ['--bg-opacity' as string]: `${settings?.background?.opacity ?? 90}%`,
      }}
    >
      <PodiumCard groups={groups} />
    </BroadcastEnter>
  );
};
