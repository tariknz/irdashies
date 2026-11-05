interface SettingButtonGroupRowProps<T extends string> {
  title: string;
  description?: string;
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
}

export function SettingButtonGroupRow<T extends string>({
  title,
  description,
  value,
  options,
  onChange,
}: SettingButtonGroupRowProps<T>) {
  return (
    <div className="flex min-h-9 flex-wrap items-center justify-between gap-4">
      <div className="min-w-0 flex-1 basis-40">
        <span className="text-md text-slate-300">{title}</span>
        {description && (
          <p className="text-sm text-slate-500 mt-1">{description}</p>
        )}
      </div>
      <div className="flex max-w-full flex-wrap items-center gap-2">
        {options.map((opt) => {
          const isActive = opt.value === value;
          return (
            <button
              key={opt.value}
              aria-pressed={isActive}
              onClick={() => onChange(opt.value)}
              className={`min-h-9 px-3 py-1.5 rounded-md text-sm font-semibold border transition-colors ${
                isActive
                  ? 'bg-accent-500 border-accent-500 text-on-accent'
                  : 'bg-transparent border-settings-boundary text-slate-300 hover:border-slate-400'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
