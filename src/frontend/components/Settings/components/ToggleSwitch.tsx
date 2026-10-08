interface ToggleSwitchProps {
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  label?: string;
  /**
   * Greys the switch and ignores clicks. The `enabled` value shown is still the
   * user's own setting -- this only stops them changing it.
   */
  disabled?: boolean;
  /** Hover text explaining why it cannot be changed. */
  disabledReason?: string;
}

export const ToggleSwitch = ({
  enabled,
  onToggle,
  label,
  disabled = false,
  disabledReason,
}: ToggleSwitchProps) => {
  return (
    <div className="flex items-center gap-3">
      {label && <span className="text-sm text-slate-200">{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-disabled={disabled}
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        onClick={() => onToggle(!enabled)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
          disabled
            ? 'cursor-not-allowed bg-slate-700 opacity-50'
            : `cursor-pointer ${enabled ? 'bg-blue-600' : 'bg-slate-600'}`
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full transition-transform ${
            disabled ? 'bg-slate-400' : 'bg-white'
          } ${enabled ? 'translate-x-6' : 'translate-x-1'}`}
        />
      </button>
    </div>
  );
};
