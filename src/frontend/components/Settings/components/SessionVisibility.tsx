import {
  BaseWidgetSettings,
  SessionVisibilitySettings,
} from '@irdashies/types';
import { SettingToggleRow } from '../components/SettingToggleRow';

type SessionKey = keyof SessionVisibilitySettings;

const TITLES: Record<SessionKey, string> = {
  race: 'Race',
  loneQualify: 'Lone Qualify',
  openQualify: 'Open Qualify',
  practice: 'Practice',
  offlineTesting: 'Offline Testing',
  warmup: 'Warmup',
};

const DEFAULT_SESSIONS: readonly SessionKey[] = [
  'race',
  'loneQualify',
  'openQualify',
  'practice',
  'offlineTesting',
];

interface SessionVisibilityProps {
  sessionVisibility: SessionVisibilitySettings;
  handleConfigChange: (newConfig: BaseWidgetSettings['config']) => void;
  /** Sessions offered, in order; a widget may leave some out or add some. */
  sessions?: readonly SessionKey[];
}

export const SessionVisibility = ({
  sessionVisibility,
  handleConfigChange,
  sessions = DEFAULT_SESSIONS,
}: SessionVisibilityProps) => {
  return (
    <div className="space-y-4">
      {sessions.map((key) => (
        <SettingToggleRow
          key={key}
          title={TITLES[key]}
          enabled={sessionVisibility[key] ?? false}
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
