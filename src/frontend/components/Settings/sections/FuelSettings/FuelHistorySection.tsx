import { FuelWidgetSettings } from '../../types';
import { DualFontSizeInput, BarFontSizeInput, HeightInput } from './FontSizeInputs';

interface FuelHistorySectionProps {
  settings: FuelWidgetSettings;
  onChange: (change: Partial<FuelWidgetSettings['config']>) => void;
}

export const FuelHistorySection = ({ settings, onChange }: FuelHistorySectionProps) => {
  return (
    <div className="pb-4 border-b border-white/5">
      <h3 className="text-lg font-medium text-slate-200 pb-4">Fuel History</h3>

      {/* Sub-settings container */}
      <div className="ml-1 pl-3 border-l border-slate-700/50 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">Graph Properties</span>
          <div className="flex items-center gap-4">
            <BarFontSizeInput widgetId="fuelGraph" settings={settings} onChange={onChange} />
            <HeightInput widgetId="fuelGraph" settings={settings} onChange={onChange} />
          </div>
        </div>

        {/* Allow configuring graph type for Fuel 2 as well */}
        {settings.config.showFuelHistory !== false && (
          <div className="space-y-3">
            {/* Graph Type & Target Wrapper */}
            <div className="flex items-center justify-between">
              <span className="text-sm text-slate-300">Graph Type</span>
              <select
                value={settings.config.fuelHistoryType}
                onChange={(e) =>
                  onChange({
                    fuelHistoryType: e.target.value as 'line' | 'histogram',
                  })
                }
                className="px-2 py-0.5 bg-slate-700 text-slate-200 rounded text-xs"
              >
                <option value="line">Line Chart</option>
                <option value="histogram">Histogram</option>
              </select>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-sm text-slate-300">Target Line</span>
                <span className="text-xs text-slate-500">Optional ref (0 to hide)</span>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="0.1"
                  placeholder="None"
                  value={settings.config.manualTarget ?? ''}
                  onChange={(e) => {
                    const val = e.target.value ? parseFloat(e.target.value.replace(',', '.')) : undefined;
                    onChange({ manualTarget: val });
                  }}
                  className="w-16 px-2 py-1 bg-slate-700 text-slate-200 rounded text-xs text-right focus:border-blue-500 focus:outline-none"
                />
                <span className="text-xs text-slate-500">{settings.config.fuelUnits}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
