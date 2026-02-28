interface SettingSliderRowProps {
  title: string;
  description?: string;
  units?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: number) => void;
  showValue?: boolean; // whether to display the value next to the title
}

export function SettingSliderRow({
  title,
  description,
  units,
  value,
  min = 0,
  max = 100,
  step = 1,
  onChange,
  showValue = true,
}: SettingSliderRowProps) {
  return (
    <div className="space-y-2">
      <label className="text-md text-slate-300">
        {title}
        <span className="text-md text-slate-400">{showValue && `: ${value}${units ? ` ${units}` : ''}`}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full cursor-pointer"
      />
      {description && (
        <p className="text-sm text-slate-500">{description}</p>
      )}
    </div>
  );
}