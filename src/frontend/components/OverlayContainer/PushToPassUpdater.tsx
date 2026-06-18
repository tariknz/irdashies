import { usePushToPassStoreUpdater } from '@irdashies/context';
import {
  useStandingsSettings,
  useRelativeSettings,
} from '../Standings/hooks';

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
