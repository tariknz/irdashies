import { useId } from 'react';

interface SettingNumberRowProps {
  title: string;
  description?: string;
  details?: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  /** Shown after the input, e.g. `px`. */
  units?: string;
  onChange: (value: number) => void;
}

export function SettingNumberRow({
  title,
  description,
  details,
  value,
  min,
  max,
  step = 1,
  units,
  onChange,
}: SettingNumberRowProps) {
  const descriptionId = useId();
  return (
    <div className="flex min-h-9 flex-wrap items-center justify-between gap-4">
      <div className="min-w-0 flex-1 basis-40">
        <h4 className="text-md font-medium text-slate-300">{title}</h4>
        {description && (
          <p id={descriptionId} className="text-sm text-slate-400 mt-1">
            {description}
          </p>
        )}
        {details && (
          <details className="mt-1 text-sm text-slate-400">
            <summary className="min-h-9 cursor-pointer py-2 text-slate-300">
              Why adjust this?
            </summary>
            <p className="pb-2 leading-relaxed">{details}</p>
          </details>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number"
          aria-label={title}
          aria-describedby={description ? descriptionId : undefined}
          className="settings-field w-24 text-right tabular-nums font-mono"
          value={value}
          step={step}
          min={min}
          max={max}
          onChange={(e) => {
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) onChange(v);
          }}
        />
        {units && <span className="text-sm text-slate-400">{units}</span>}
      </div>
    </div>
  );
}
