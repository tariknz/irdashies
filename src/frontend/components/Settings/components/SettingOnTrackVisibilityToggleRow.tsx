import { SettingToggleRow } from './SettingToggleRow';
import { OnTrackVisibilityConfig } from '@irdashies/types';

interface OnTrackVisibilityProps {
  config: OnTrackVisibilityConfig;
  handleConfigChange: (config: Record<string, unknown>) => void;
}

export const SettingOnTrackVisibilityToggleRow = ({
  config,
  handleConfigChange,
}: OnTrackVisibilityProps) => (
  <SettingToggleRow
    title="Show only when on track"
    description="If enabled, widget will only be shown when driving"
    enabled={config.showOnlyWhenOnTrack ?? false}
    onToggle={(newValue) =>
      handleConfigChange({ showOnlyWhenOnTrack: newValue })
    }
  />
);
