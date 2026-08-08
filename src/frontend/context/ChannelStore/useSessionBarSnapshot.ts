import { useWidgetChannelRate } from '../../widgetRuntime';
import { useChannelSnapshot } from './useChannelSnapshot';
export const useSessionBarSnapshot = () =>
  useChannelSnapshot(
    'session-bar.snapshot',
    useWidgetChannelRate('session-bar.snapshot')
  );
