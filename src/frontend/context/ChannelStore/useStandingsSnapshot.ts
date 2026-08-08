import { useWidgetChannelRate } from '../../widgetRuntime';
import { useChannelSnapshot } from './useChannelSnapshot';

export const useStandingsSnapshot = (enabled = true) =>
  useChannelSnapshot(
    'standings.snapshot',
    useWidgetChannelRate('standings.snapshot'),
    undefined,
    enabled
  );
