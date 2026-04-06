import { BaseWidgetSettings, SessionVisibilityConfig } from '@irdashies/types';
import { SettingToggleRow } from './SettingToggleRow';

interface SessionVisibilityProps {
  config: SessionVisibilityConfig;
  handleConfigChange: (newConfig: BaseWidgetSettings['config']) => void;
}

/**
 * Section in widget settings for session visibility related settings.
 * This should only be used within the overall {@link SettingVisibilitySection} widget
 */
export const SettingSessionVisibilitySection = ({
  config,
  handleConfigChange,
}: SessionVisibilityProps) => {
  return (
    <div className="space-y-4">
      {/* Show In Race Session */}
      <SettingToggleRow
        title="Race"
        enabled={config.sessionVisibility.race ?? false}
        onToggle={(enabled) =>
          handleConfigChange({
            sessionVisibility: { ...config, race: enabled },
          })
        }
      />

      {/* Show In Lone Qualify Session */}
      <SettingToggleRow
        title="Lone Qualify"
        enabled={config.sessionVisibility.loneQualify ?? false}
        onToggle={(enabled) =>
          handleConfigChange({
            sessionVisibility: { ...config, loneQualify: enabled },
          })
        }
      />

      {/* Show In Open Qualify Session */}
      <SettingToggleRow
        title="Open Qualify"
        enabled={config.sessionVisibility.openQualify ?? false}
        onToggle={(enabled) =>
          handleConfigChange({
            sessionVisibility: { ...config, openQualify: enabled },
          })
        }
      />

      {/* Show In Practice Session */}
      <SettingToggleRow
        title="Practice"
        enabled={config.sessionVisibility.practice ?? false}
        onToggle={(enabled) =>
          handleConfigChange({
            sessionVisibility: { ...config, practice: enabled },
          })
        }
      />

      {/* Show In Offline Testing Session */}
      <SettingToggleRow
        title="Offline Testing"
        enabled={config.sessionVisibility.offlineTesting ?? false}
        onToggle={(enabled) =>
          handleConfigChange({
            sessionVisibility: {
              ...config,
              offlineTesting: enabled,
            },
          })
        }
      />
    </div>
  );
};
