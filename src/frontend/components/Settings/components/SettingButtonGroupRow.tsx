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
              className={`px-3 py-1 rounded text-sm transition-colors ${
                isActive
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-600 text-slate-300 hover:bg-slate-500'
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
