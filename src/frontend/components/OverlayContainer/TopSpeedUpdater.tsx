import { TopSpeedStoreUpdater } from '@irdashies/context';
import {
  useStandingsSettings,
  useRelativeSettings,
  useInformationBarSettings,
} from '../Standings/hooks';

export const TopSpeedUpdater = () => {
  const standingsSettings = useStandingsSettings();
  const relativeSettings = useRelativeSettings();
  const infobarSettings = useInformationBarSettings();

  const enabled = !!(
    standingsSettings?.headerBar?.topSpeed?.enabled ||
    standingsSettings?.footerBar?.topSpeed?.enabled ||
    relativeSettings?.headerBar?.topSpeed?.enabled ||
    relativeSettings?.footerBar?.topSpeed?.enabled ||
    infobarSettings?.topSpeed?.enabled
  );

  // Mount conditionally rather than always-mounting with enabled={false}:
  // TopSpeedStoreUpdater's own telemetry subscriptions run unconditionally
  // once mounted (React can't skip a hook call from inside), so the only way
  // to actually avoid them when nothing needs topSpeed is to not mount it.
  if (!enabled) return null;
  return <TopSpeedStoreUpdater enabled={enabled} />;
};
