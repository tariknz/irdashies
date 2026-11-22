import { useDashboard, useSessionTimeTiming } from '@irdashies/context';
import { useDriverStandings } from '@irdashies/domain/standings/useDriverStandings';
import { racePhase } from '@irdashies/domain/broadcast/broadcastRows';
import { useDemoFrame } from '@irdashies/utils/useDemoFrame';
import { BroadcastEnter } from '../shared/Broadcast/BroadcastEnter';
import { useBroadcastConfig } from '@irdashies/domain/broadcast/useBroadcastConfig';
import { getDemoPodiumGroups } from './demoPodium';
import { PodiumCard } from './PodiumCard';

/**
 * The podium of each class, up after the checkered flag of a race. Demo mode
 * shows it too, so it can be placed in Edit Layout and OBS.
 */
export const BroadcastPodium = () => {
  const { isDemoMode } = useDashboard();
  const settings = useBroadcastConfig('broadcastpodium');
  const { sessionType, state } = useSessionTimeTiming();
  const liveGroups = useDriverStandings(undefined, { showAll: true });
  const demoGroups = useDemoFrame(isDemoMode, getDemoPodiumGroups);
  const groups = isDemoMode ? (demoGroups ?? []) : liveGroups;

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
      <PodiumCard groups={groups} look={settings?.style} />
    </BroadcastEnter>
  );
};
