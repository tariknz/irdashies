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
      className="px-3 py-1 text-sm bg-slate-600 hover:bg-slate-500 text-slate-300 rounded-md transition-colors"
    >
      {label}
    </button>
  );

  if (!title && !description) {
    return <div className="flex justify-end mb-2">{button}</div>;
  }

  return (
    <div className="flex items-center justify-between">
      <div className="max-w-[70%]">
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
