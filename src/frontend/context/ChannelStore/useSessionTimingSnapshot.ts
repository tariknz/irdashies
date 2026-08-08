import { useWidgetChannelRate } from '../../widgetRuntime';
import { useChannelSnapshot } from './useChannelSnapshot';

export const useSessionTimingSnapshot = (enabled = true) =>
  useChannelSnapshot(
    'session-timing.snapshot',
    useWidgetChannelRate('session-timing.snapshot'),
    undefined,
    enabled
  );
