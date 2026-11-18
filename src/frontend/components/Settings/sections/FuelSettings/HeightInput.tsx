import { FuelWidgetSettings } from '@irdashies/types';

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
