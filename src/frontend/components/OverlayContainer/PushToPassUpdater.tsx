import { usePushToPassStoreUpdater } from '@irdashies/context';
import { useStandingsSettings, useRelativeSettings } from '@irdashies/domain';

export const PushToPassUpdater = () => {
  const standingsSettings = useStandingsSettings();
  const relativeSettings = useRelativeSettings();

  const enabled = !!(
    standingsSettings?.pushToPass?.enabled ||
    relativeSettings?.pushToPass?.enabled
  );

  usePushToPassStoreUpdater(enabled);
  return null;
};
