import { usePitLapStoreUpdater } from '@irdashies/context';
import { useStandingsSettings, useRelativeSettings } from '../Standings/hooks';
import { useBattleSettings } from '../Battle/hooks/useBattleSettings';

export const PitLapUpdater = () => {
  const standingsSettings = useStandingsSettings();
  const relativeSettings = useRelativeSettings();
  const battleSettings = useBattleSettings();

  const enabled = !!(
    standingsSettings?.pitStatus?.enabled ||
    relativeSettings?.pitStatus?.enabled ||
    battleSettings?.stint?.enabled
  );

  usePitLapStoreUpdater(enabled);
  return null;
};
