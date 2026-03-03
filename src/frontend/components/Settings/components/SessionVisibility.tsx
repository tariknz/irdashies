import { BaseWidgetSettings, SessionVisibilitySettings } from '../types';
import { SettingToggleRow } from '../components/SettingToggleRow';

interface SessionVisibilityProps {
  sessionVisibility: SessionVisibilitySettings;
  handleConfigChange: (newConfig: BaseWidgetSettings['config']) => void;
}

export const SessionVisibility = ({
  sessionVisibility,
  handleConfigChange,
}: SessionVisibilityProps) => {
  return (
    <div className="space-y-4">

      {/* Show In Race Session */}
      <SettingToggleRow
        title="Race"
        enabled={sessionVisibility.race ?? false}
        onToggle={(enabled) =>
          handleConfigChange({
            sessionVisibility: { ...sessionVisibility, race: enabled },
          })
        }
      />

      {/* Show In Lone Qualify Session */}
      <SettingToggleRow
        title="Lone Qualify"
        enabled={sessionVisibility.loneQualify ?? false}
        onToggle={(enabled) =>
          handleConfigChange({
            sessionVisibility: { ...sessionVisibility, loneQualify: enabled },
          })
        }
      />      

      {/* Show In Open Qualify Session */}
      <SettingToggleRow
        title="Open Qualify"
        enabled={sessionVisibility.openQualify ?? false}
        onToggle={(enabled) =>
          handleConfigChange({
            sessionVisibility: { ...sessionVisibility, openQualify: enabled },
          })
        }
      />     

      {/* Show In Practice Session */}
      <SettingToggleRow
        title="Practice"
        enabled={sessionVisibility.practice ?? false}
        onToggle={(enabled) =>
          handleConfigChange({
            sessionVisibility: { ...sessionVisibility, practice: enabled },
          })
        }
      />    

      {/* Show In Offline Testing Session */}
      <SettingToggleRow
        title="Offline Testing"
        enabled={sessionVisibility.offlineTesting ?? false}
        onToggle={(enabled) =>
          handleConfigChange({
            sessionVisibility: { ...sessionVisibility, offlineTesting: enabled },
          })
        }
      />

    </div>
  );
};
