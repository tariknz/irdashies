interface SettingActionButtonProps {
  label: string;
  onClick: () => void;
  className?: string;
  align?: 'start' | 'center' | 'end';
}

export function SettingActionButton({
  label,
  onClick,
  className = '',
  align = 'end',
}: SettingActionButtonProps) {
  const alignmentClass =
    align === 'center'
      ? 'justify-center'
      : align === 'start'
        ? 'justify-start'
        : 'justify-end';

  return (
    <div className={`flex ${alignmentClass} mb-2 ${className}`}>
      <button
        type="button"
        onClick={onClick}
        className="px-3 py-1 text-sm bg-slate-600 hover:bg-slate-500 text-slate-300 rounded-md transition-colors"
      >
        {label}
      </button>
    </div>
  );
}
