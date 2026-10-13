import {
  BaseWidgetSettings,
  DEFAULT_SESSION_KEYS,
  SESSION_VISIBILITY_LABELS,
  SessionVisibilitySettings,
} from '@irdashies/types';
import { SettingToggleRow } from '../components/SettingToggleRow';

type SessionKey = keyof SessionVisibilitySettings;

interface SessionVisibilityProps {
  sessionVisibility: SessionVisibilitySettings;
  handleConfigChange: (newConfig: BaseWidgetSettings['config']) => void;
  /** Sessions offered, in order; a widget may leave some out or add some. */
  sessions?: readonly SessionKey[];
}

export const SessionVisibility = ({
  sessionVisibility,
  handleConfigChange,
  sessions = DEFAULT_SESSION_KEYS,
}: SessionVisibilityProps) => {
  return (
    <div className="space-y-4">
      {sessions.map((key) => (
        <SettingToggleRow
          key={key}
          title={SESSION_VISIBILITY_LABELS[key]}
          enabled={sessionVisibility[key] ?? true}
          onToggle={(enabled) =>
            handleConfigChange({
              sessionVisibility: { ...sessionVisibility, [key]: enabled },
            })
          }
        />
      ))}
    </div>
  );
};
