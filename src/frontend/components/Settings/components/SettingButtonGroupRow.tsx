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
    <div className="flex items-center justify-between">
      <div className="max-w-[70%]">
        <span className="text-md text-slate-300">{title}</span>
        {description && (
          <p className="text-sm text-slate-500 mt-1">{description}</p>
        )}
      </div>
      <div className="flex items-center gap-2">
        {options.map((opt) => {
          const isActive = opt.value === value;
          return (
            <button
              key={opt.value}
              onClick={() => onChange(opt.value)}
              className={`px-3 py-1 rounded text-sm skew-ui settings-heading font-semibold border transition-colors ${
                isActive
                  ? 'bg-accent-500 border-accent-500 text-on-accent'
                  : 'bg-transparent border-slate-600 text-slate-300 hover:border-slate-400'
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
