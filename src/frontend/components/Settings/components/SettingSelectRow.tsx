interface SettingSelectRowProps<T extends string> {
  title: string;
  description?: string;
  value: T;
  options: { label: string; value: T }[];
  onChange: (value: T) => void;
}

export function SettingSelectRow<T extends string>({
  title,
  description,
  value,
  options,
  onChange,
}: SettingSelectRowProps<T>) {
  return (
    <div className="flex items-center justify-between">
      <div className="max-w-[70%]">
        <h4 className="text-md font-medium text-slate-300">{title}</h4>
        {description && (
          <p className="text-sm text-slate-500 mt-1">{description}</p>
        )}
      </div>

      <select
        className="bg-slate-700 text-white rounded-md px-2 py-1"
        value={value}
        onChange={(e) => onChange(e.target.value as T)}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}