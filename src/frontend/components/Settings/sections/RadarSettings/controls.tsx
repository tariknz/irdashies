import { useMemo } from 'react';
import { useSessionDrivers } from '@irdashies/context';
import { typicalCarSize, type CarSize } from '@irdashies/domain/radar/carSizes';
import { SettingSliderRow } from '../../components/SettingSliderRow';
import { SettingSelectRow } from '../../components/SettingSelectRow';
import { HIGHLIGHT_COLOR_PRESETS } from '../GeneralSettings';
import { paler } from '../../../Radar/radarColors';

const COLOR_OPTIONS = [
  { label: 'White', value: '16777215' },
  ...Array.from(HIGHLIGHT_COLOR_PRESETS.entries()).map(([value, label]) => ({
    label,
    value: String(value),
  })),
];

export const hex = (color: number) => `#${color.toString(16).padStart(6, '0')}`;

export const ColorRow = ({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
}) => (
  <div className="flex items-center gap-3">
    <span
      className="rounded border-2 border-slate-600 shrink-0"
      style={{ width: 20, height: 20, backgroundColor: hex(value) }}
    />
    <div className="flex-1">
      <SettingSelectRow
        title={title}
        description={description}
        value={String(value)}
        options={COLOR_OPTIONS}
        onChange={(v) => onChange(parseInt(v, 10))}
      />
    </div>
  </div>
);

/** Free colour pick; until one is made, a paler shade of our own car. */
export const CustomColorRow = ({
  value,
  playerColor,
  onChange,
}: {
  value: number | null;
  playerColor: number;
  onChange: (value: number | null) => void;
}) => {
  const shown = value === null ? paler(hex(playerColor)) : hex(value);
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <div className="text-sm text-slate-300">Rival Fill</div>
        <div className="text-xs text-slate-500">
          {value === null ? 'A paler shade of your car.' : 'Your own pick.'}
        </div>
      </div>
      <div className="flex items-center gap-2">
        {value !== null && (
          <button
            type="button"
            className="text-xs text-slate-400 hover:text-slate-200"
            onClick={() => onChange(null)}
          >
            Reset
          </button>
        )}
        <input
          type="color"
          value={shown}
          onChange={(e) => onChange(parseInt(e.target.value.slice(1), 16))}
          className="w-10 h-8 bg-slate-700 rounded cursor-pointer"
        />
      </div>
    </div>
  );
};

interface SessionClass {
  name: string;
  color: number;
  carName: string;
}

/**
 * One row per class in the current session, so sizes can be tuned for the
 * field actually on track. Outside a session there is nothing to list.
 */
export const ClassSizeRows = ({
  classSizes,
  fallback,
  onChange,
}: {
  classSizes: Record<string, CarSize>;
  fallback: CarSize;
  onChange: (classSizes: Record<string, CarSize>) => void;
}) => {
  const drivers = useSessionDrivers();
  const classes = useMemo(() => {
    const byName = new Map<string, SessionClass>();
    for (const driver of drivers ?? []) {
      if (driver.CarIsPaceCar === 1 || !driver.CarClassShortName) continue;
      if (!byName.has(driver.CarClassShortName)) {
        byName.set(driver.CarClassShortName, {
          name: driver.CarClassShortName,
          color: driver.CarClassColor,
          carName: driver.CarScreenName,
        });
      }
    }
    return [...byName.values()];
  }, [drivers]);

  if (classes.length === 0) {
    return (
      <p className="text-xs text-slate-400">
        Join a session to adjust the size of each class in it.
      </p>
    );
  }

  const setSize = (name: string, size: CarSize | undefined) => {
    const others = Object.fromEntries(
      Object.entries(classSizes).filter(([key]) => key !== name)
    );
    onChange(size ? { ...others, [name]: size } : others);
  };

  return (
    <div className="space-y-3">
      {classes.map((carClass) => {
        const saved = classSizes[carClass.name];
        const size =
          saved ?? typicalCarSize(carClass.name, carClass.carName) ?? fallback;
        return (
          <div
            key={carClass.name}
            className="rounded border border-slate-700/60 p-2 space-y-2"
          >
            <div className="flex items-center gap-2">
              <span
                className="rounded-sm shrink-0"
                style={{
                  width: 12,
                  height: 12,
                  backgroundColor: hex(carClass.color),
                }}
              />
              <span className="text-sm text-slate-200 flex-1">
                {carClass.name}
              </span>
              {saved ? (
                <button
                  type="button"
                  className="text-xs text-slate-400 hover:text-slate-200"
                  onClick={() => setSize(carClass.name, undefined)}
                >
                  Reset
                </button>
              ) : (
                <span className="text-xs text-slate-500">typical</span>
              )}
            </div>
            <SettingSliderRow
              title="Length"
              value={size.length}
              units="m"
              min={3}
              max={6}
              step={0.05}
              onChange={(length) => setSize(carClass.name, { ...size, length })}
            />
            <SettingSliderRow
              title="Width"
              value={size.width}
              units="m"
              min={1.4}
              max={2.4}
              step={0.05}
              onChange={(width) => setSize(carClass.name, { ...size, width })}
            />
          </div>
        );
      })}
    </div>
  );
};

/** Free colour pick for a setting stored as a number. */
export const ColorPickRow = ({
  title,
  description,
  value,
  onChange,
}: {
  title: string;
  description?: string;
  value: number;
  onChange: (value: number) => void;
}) => (
  <div className="flex items-center justify-between gap-3">
    <div>
      <h4 className="text-md font-medium text-slate-300">{title}</h4>
      {description && <p className="text-sm text-slate-500">{description}</p>}
    </div>
    <input
      type="color"
      aria-label={title}
      value={hex(value)}
      onChange={(e) => onChange(parseInt(e.target.value.slice(1), 16))}
      className="w-10 h-8 bg-slate-700 rounded cursor-pointer shrink-0"
    />
  </div>
);

/** A number typed in, for the dev tuning. */
export const NumberRow = ({
  title,
  description,
  value,
  min,
  max,
  step,
  onChange,
}: {
  title: string;
  description?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) => (
  <div className="flex items-center justify-between gap-3">
    <div>
      <h4 className="text-sm font-mono text-slate-300">{title}</h4>
      {description && <p className="text-sm text-slate-500">{description}</p>}
    </div>
    <input
      type="number"
      aria-label={title}
      value={value}
      min={min}
      max={max}
      step={step}
      onChange={(e) => {
        const next = parseFloat(e.target.value);
        if (Number.isFinite(next)) {
          onChange(Math.min(max, Math.max(min, next)));
        }
      }}
      className="w-24 rounded-md bg-slate-700 text-white px-2 py-1 text-right font-mono text-sm shrink-0"
    />
  </div>
);
