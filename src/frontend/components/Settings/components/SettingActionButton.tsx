interface SettingActionButtonProps {
  label: string;
  onClick: () => void;
  title?: string;
  description?: string;
}

export function SettingActionButton({
  label,
  onClick,
  title,
  description,
}: SettingActionButtonProps) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      className="min-h-9 px-3 py-1.5 text-sm font-semibold border border-settings-boundary bg-slate-800 hover:border-accent-400 text-slate-200 rounded-md transition-colors"
    >
      {label}
    </button>
  );

  if (!title && !description) {
    return <div className="flex justify-end mb-2">{button}</div>;
  }

  return (
    <div className="flex min-h-9 flex-wrap items-center justify-between gap-4">
      <div className="min-w-0 flex-1 basis-40">
        {title && (
          <h4 className="text-md font-medium text-slate-300">{title}</h4>
        )}
        {description && (
          <p className="text-sm text-slate-500 mt-1">{description}</p>
        )}
      </div>
      {button}
    </div>
  );
}
