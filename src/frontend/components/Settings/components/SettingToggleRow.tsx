import { t } from '@irdashies/frontend/i18n';
import { ToggleSwitch } from './ToggleSwitch';

interface SettingToggleRowProps {
  title: string;
  description?: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
}

export function SettingToggleRow({
  title,
  description,
  enabled,
  onToggle,
}: SettingToggleRowProps) {
  return (
    <div className="flex min-h-9 items-center justify-between gap-5">
      <div>
        <h4 className="text-md font-medium text-slate-300">{t(title)}</h4>
        {description && (
          <p className="mt-1 text-sm text-slate-400">{t(description)}</p>
        )}
      </div>

      <ToggleSwitch
        enabled={enabled}
        onToggle={onToggle}
        ariaLabel={t(title)}
      />
    </div>
  );
}
