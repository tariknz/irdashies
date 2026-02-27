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
    <div className="flex items-center justify-between">
      <div>
        <h4 className="text-md font-medium text-slate-300">
          {title}
        </h4>
        {description && (
          <p className="text-xs text-slate-500 pr-8">
            {description}
          </p>
        )}
      </div>

      <ToggleSwitch
        enabled={enabled}
        onToggle={onToggle}
      />
    </div>
  );
}