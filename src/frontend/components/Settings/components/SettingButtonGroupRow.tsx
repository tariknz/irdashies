interface SettingButtonGroupRowProps<T extends string> {
  title: string;
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
}

export function SettingButtonGroupRow<T extends string>({
  title,
  value,
  options,
  onChange,
}: SettingButtonGroupRowProps<T>) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-md text-slate-300">{title}</span>
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