import { useWidgetChannelRate } from '../../widgetRuntime';
import { useChannelSnapshot } from './useChannelSnapshot';

export const useStandingsSnapshot = () =>
  useChannelSnapshot(
    'standings.snapshot',
    useWidgetChannelRate('standings.snapshot')
  );
