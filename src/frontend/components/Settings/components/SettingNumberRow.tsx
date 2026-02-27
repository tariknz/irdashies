interface SettingNumberRowProps {
  title: string;
  description?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
}

export function SettingNumberRow({
  title,
  description,
  value,
  min,
  max,
  step = 1,
  onChange,
}: SettingNumberRowProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="max-w-[70%]">
        <h4 className="text-md font-medium text-slate-300">{title}</h4>
        {description && (
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        )}
      </div>

      <input
        type="number"
        className="w-24 rounded-md bg-slate-700 text-white px-2 py-1 text-right"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = parseFloat(e.target.value);
          if (!Number.isNaN(v)) onChange(v);
        }}
      />
    </div>
  );
}