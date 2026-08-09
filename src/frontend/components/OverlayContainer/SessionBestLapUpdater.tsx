import { SessionBestLapStoreUpdater } from '@irdashies/context';
import {
  useStandingsSettings,
  useRelativeSettings,
  useInformationBarSettings,
} from '@irdashies/domain';

export const SessionBestLapUpdater = () => {
  const standingsSettings = useStandingsSettings();
  const relativeSettings = useRelativeSettings();
  const infobarSettings = useInformationBarSettings();

  const enabled = !!(
    standingsSettings?.headerBar?.lastLap?.enabled ||
    standingsSettings?.headerBar?.bestLap?.enabled ||
    standingsSettings?.footerBar?.lastLap?.enabled ||
    standingsSettings?.footerBar?.bestLap?.enabled ||
    relativeSettings?.headerBar?.lastLap?.enabled ||
    relativeSettings?.headerBar?.bestLap?.enabled ||
    relativeSettings?.footerBar?.lastLap?.enabled ||
    relativeSettings?.footerBar?.bestLap?.enabled ||
    infobarSettings?.lastLap?.enabled ||
    infobarSettings?.bestLap?.enabled
  );

  if (!enabled) return null;
  return <SessionBestLapStoreUpdater enabled={enabled} />;
};
