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
  /** Compact variant for dense lists such as the settings menu. */
  small?: boolean;
  /** Accessible name when there is no visible `label`. */
  ariaLabel?: string;
  /** Id of an element naming the switch, e.g. the row's heading. */
  ariaLabelledBy?: string;
}

export const ToggleSwitch = ({
  enabled,
  onToggle,
  label,
  disabled = false,
  disabledReason,
  small = false,
  ariaLabel,
  ariaLabelledBy,
}: ToggleSwitchProps) => {
  return (
    <div className="flex items-center gap-3">
      {label && <span className="text-sm text-slate-200">{label}</span>}
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={ariaLabel}
        aria-labelledby={ariaLabelledBy}
        aria-disabled={disabled}
        disabled={disabled}
        title={disabled ? disabledReason : undefined}
        onClick={() => onToggle(!enabled)}
        className={`relative inline-flex ${small ? 'h-4 w-8' : 'h-6 w-11'} items-center rounded-sm skew-ui transition-colors focus:outline-none focus:ring-2 focus:ring-accent-500 focus:ring-offset-2 ${
          disabled
            ? 'cursor-not-allowed bg-slate-700 opacity-50'
            : `cursor-pointer ${enabled ? 'bg-accent-500' : 'bg-slate-600'}`
        }`}
      >
        <span
          className={`inline-block ${small ? 'h-3 w-3' : 'h-4 w-4'} transform rounded-sm transition-transform ${
            disabled ? 'bg-slate-400' : 'bg-white'
          } ${enabled ? (small ? 'translate-x-4.5' : 'translate-x-6') : small ? 'translate-x-0.5' : 'translate-x-1'}`}
        />
      </button>
    </div>
  );
};
