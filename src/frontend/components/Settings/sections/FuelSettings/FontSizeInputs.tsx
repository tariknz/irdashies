import { FuelWidgetSettings } from '@irdashies/types';

export const DualFontSizeInput = ({
  widgetId,
  title,
  description,
  settings,
  onChange,
}: {
  widgetId: string;
  title: string;
  description: string;
  settings: FuelWidgetSettings;
  onChange: (change: Partial<FuelWidgetSettings['config']>) => void;
}) => {
  const style = settings.config.widgetStyles?.[widgetId] || {};
  const labelSize = style.labelFontSize ?? style.fontSize ?? 12;
  const valueSize = style.valueFontSize ?? style.fontSize ?? 20;

  const updateStyle = (key: 'labelFontSize' | 'valueFontSize', val: number) => {
    const newStyles = { ...settings.config.widgetStyles };
    newStyles[widgetId] = { ...newStyles[widgetId], [key]: val };
    onChange({ widgetStyles: newStyles });
  };

  return (
    <div className="grid grid-cols-1 items-center gap-4 border-b border-slate-700 py-4 lg:grid-cols-[minmax(0,1fr)_220px]">
      <div>
        <span className="text-md text-slate-300">{title}</span>
        {description && (
          <span className="mt-1 block text-sm text-slate-400">
            {description}
          </span>
        )}
      </div>
      <div className="flex w-full min-w-0 flex-col gap-2">
        <div className="grid grid-cols-[3rem_minmax(0,1fr)_2rem] items-center gap-2">
          <span className="text-sm text-slate-400">Label</span>
          <input
            type="range"
            aria-label={`${title} label font size`}
            min="8"
            max="48"
            step="1"
            value={labelSize}
            onChange={(e) =>
              updateStyle('labelFontSize', parseInt(e.target.value))
            }
            className="h-5 w-full min-w-0 cursor-pointer accent-accent-400"
          />
          <span className="text-right text-sm tabular-nums text-slate-300">
            {labelSize}
          </span>
        </div>
        <div className="grid grid-cols-[3rem_minmax(0,1fr)_2rem] items-center gap-2">
          <span className="text-sm text-slate-400">Value</span>
          <input
            type="range"
            aria-label={`${title} value font size`}
            min="8"
            max="64"
            step="1"
            value={valueSize}
            onChange={(e) =>
              updateStyle('valueFontSize', parseInt(e.target.value))
            }
            className="h-5 w-full min-w-0 cursor-pointer accent-accent-400"
          />
          <span className="text-right text-sm tabular-nums text-slate-300">
            {valueSize}
          </span>
        </div>
      </div>
    </div>
  );
};

export const BarFontSizeInput = ({
  widgetId,
  settings,
  onChange,
}: {
  widgetId: string;
  settings: FuelWidgetSettings;
  onChange: (change: Partial<FuelWidgetSettings['config']>) => void;
}) => {
  const style = settings.config.widgetStyles?.[widgetId];
  const fontSize = style?.barFontSize;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400 w-8">Inside</span>
      <input
        type="range"
        aria-label={`${widgetId} bar font size`}
        min="6"
        max="32"
        step="1"
        value={fontSize ?? 8}
        onChange={(e) => {
          const val = parseInt(e.target.value);
          const newStyles = { ...settings.config.widgetStyles };
          newStyles[widgetId] = { ...newStyles[widgetId], barFontSize: val };
          onChange({ widgetStyles: newStyles });
        }}
        className="h-5 w-16 min-w-0 flex-1 cursor-pointer accent-accent-400"
      />
      <span className="text-xs text-slate-300 w-4 text-right">
        {fontSize ?? 8}
      </span>
    </div>
  );
};

export const HeightInput = ({
  widgetId,
  settings,
  onChange,
}: {
  widgetId: string;
  settings: FuelWidgetSettings;
  onChange: (change: Partial<FuelWidgetSettings['config']>) => void;
}) => {
  const style = settings.config.widgetStyles?.[widgetId];
  const height = style?.height;

  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
        aria-label={`${widgetId} height`}
        min="40"
        max="300"
        step="5"
        value={height ?? 64}
        onChange={(e) => {
          const val = parseInt(e.target.value);
          const newStyles = { ...settings.config.widgetStyles };
          newStyles[widgetId] = { ...newStyles[widgetId], height: val };
          onChange({ widgetStyles: newStyles });
        }}
        className="h-5 w-24 min-w-0 cursor-pointer accent-accent-400"
      />
      <span className="text-xs text-slate-300 w-8 text-right">
        {height ?? 64}px
      </span>
    </div>
  );
};
