import { BaseWidgetSettings, SessionVisibilitySettings } from '../types';
import { ToggleSwitch } from './ToggleSwitch';

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
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-md font-medium text-slate-300">
            Race
          </h4>
        </div>
        <ToggleSwitch
          enabled={sessionVisibility.race ?? false}
          onToggle={(enabled) =>
            handleConfigChange({
              sessionVisibility: { ...sessionVisibility, race: enabled },
            })
          }
        />
      </div>

      {/* Show In Lone Qualify Session */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-md font-medium text-slate-300">
            Lone Qualify
          </h4>
        </div>
        <ToggleSwitch
          enabled={sessionVisibility.loneQualify ?? false}
          onToggle={(enabled) =>
            handleConfigChange({
              sessionVisibility: { ...sessionVisibility, loneQualify: enabled },
            })
          }
        />
      </div>

      {/* Show In Open Qualify Session */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-md font-medium text-slate-300">
            Open Qualify
          </h4>
        </div>
        <ToggleSwitch
          enabled={sessionVisibility.openQualify ?? false}
          onToggle={(enabled) =>
            handleConfigChange({
              sessionVisibility: { ...sessionVisibility, openQualify: enabled },
            })
          }
        />
      </div>

      {/* Show In Practice Session */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-md font-medium text-slate-300">
            Practice
          </h4>
        </div>
        <ToggleSwitch
          enabled={sessionVisibility.practice ?? false}
          onToggle={(enabled) =>
            handleConfigChange({
              sessionVisibility: { ...sessionVisibility, practice: enabled },
            })
          }
        />
      </div>

      {/* Show In Offline Testing Session */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-md font-medium text-slate-300">
            Offline Testing
          </h4>
        </div>
        <ToggleSwitch
          enabled={sessionVisibility.offlineTesting ?? false}
          onToggle={(enabled) =>
            handleConfigChange({
              sessionVisibility: {
                ...sessionVisibility,
                offlineTesting: enabled,
              },
            })
          }
        />
      </div>
    </div>
  );
};
