import {
  isOnTrackVisibilityConfig,
  isSessionVisibilityConfig,
} from '@irdashies/types';
import { SettingsSection } from './SettingSection';
import { SettingSessionVisibilitySection } from './SettingSessionVisibilitySection';
import { SettingDivider } from './SettingDivider';
import { SettingOnTrackVisibilityToggleRow } from './SettingOnTrackVisibilityToggleRow';

interface SettingVisibilitySectionProps {
  config: unknown;
  handleConfigChange: (config: Record<string, unknown>) => void;
}

/**
 * Section in widget settings for visibility related settings, handles all possible common visibility settings,
 * such as session visibility and only show on track visibility.
 */
export const SettingVisibilitySection = ({
  config,
  handleConfigChange,
}: SettingVisibilitySectionProps) => {
  const isSessionConfig = isSessionVisibilityConfig(config);
  const isOnTrackConfig = isOnTrackVisibilityConfig(config);

  return (
    <SettingsSection title="Visibility">
      {isSessionConfig && (
        <SettingSessionVisibilitySection
          config={config}
          handleConfigChange={handleConfigChange}
        />
      )}

      {isOnTrackConfig && (
        <>
          <SettingDivider />
          <SettingOnTrackVisibilityToggleRow
            config={config}
            handleConfigChange={handleConfigChange}
          />
        </>
      )}
    </SettingsSection>
  );
};
