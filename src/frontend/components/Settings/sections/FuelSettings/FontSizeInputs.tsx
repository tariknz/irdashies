import { FuelWidgetSettings } from '../../types';

export const DualFontSizeInput = ({ widgetId, title, description, settings, onChange }: { widgetId: string, title: string, description: string, settings: FuelWidgetSettings, onChange: (change: Partial<FuelWidgetSettings['config']>) => void }) => {
  const style = settings.config.widgetStyles?.[widgetId] || {};
  const labelSize = style.labelFontSize ?? style.fontSize ?? 12;
  const valueSize = style.valueFontSize ?? style.fontSize ?? 20;

  const updateStyle = (key: 'labelFontSize' | 'valueFontSize', val: number) => {
    const newStyles = { ...settings.config.widgetStyles };
    newStyles[widgetId] = { ...newStyles[widgetId], [key]: val };
    onChange({ widgetStyles: newStyles });
  };

  return (
    <div className="flex items-center justify-between py-4 mb-0 border-b border-white/5">
      <div>
        <span className="text-md text-slate-300">{title}</span>
        {description && (
          <span className="block text-sm text-slate-500 pr-8">{description}</span>
        )}        
      </div>
      <div className="flex flex-col gap-1 w-full max-w-[140px] mr-20">
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 w-8">Label</span>
          <input
            type="range" min="8" max="48" step="1"
            value={labelSize}
            onChange={(e) => updateStyle('labelFontSize', parseInt(e.target.value))}
            className="flex-1 h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
          />
          <span className="text-xs text-slate-300 w-4 text-right">{labelSize}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400 w-8">Value</span>
          <input
            type="range" min="8" max="64" step="1"
            value={valueSize}
            onChange={(e) => updateStyle('valueFontSize', parseInt(e.target.value))}
            className="flex-1 h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
          />
          <span className="text-xs text-slate-300 w-4 text-right">{valueSize}</span>
        </div>
      </div>
    </div>
  );
};

export const BarFontSizeInput = ({ widgetId, settings, onChange }: { widgetId: string, settings: FuelWidgetSettings, onChange: (change: Partial<FuelWidgetSettings['config']>) => void }) => {
  const style = settings.config.widgetStyles?.[widgetId];
  const fontSize = style?.barFontSize;

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-400 w-8">Inside</span>
      <input
        type="range"
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
        className="flex-1 h-1.5 bg-slate-600 rounded-lg appearance-none cursor-pointer slider w-[60px]"
      />
      <span className="text-xs text-slate-300 w-4 text-right">{fontSize ?? 8}</span>
    </div>
  );
};

export const HeightInput = ({ widgetId, settings, onChange }: { widgetId: string, settings: FuelWidgetSettings, onChange: (change: Partial<FuelWidgetSettings['config']>) => void }) => {
  const style = settings.config.widgetStyles?.[widgetId];
  const height = style?.height;

  return (
    <div className="flex items-center gap-2">
      <input
        type="range"
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
        className="w-24 h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer slider"
      />
      <span className="text-xs text-slate-300 w-8 text-right">{height ?? 64}px</span>
    </div>
  );
};
