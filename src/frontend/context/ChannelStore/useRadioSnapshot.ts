import { useWidgetChannelRate } from '../../widgetRuntime';
import { useChannelSnapshot } from './useChannelSnapshot';

export const useRadioSnapshot = (enabled = true) =>
  useChannelSnapshot(
    'radio.snapshot',
    useWidgetChannelRate('radio.snapshot'),
    undefined,
    enabled
  );
