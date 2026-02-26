import { FuelWidgetSettings } from '../../types';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { DualFontSizeInput } from './FontSizeInputs';

interface PitStrategySectionProps {
  settings: FuelWidgetSettings;
  onChange: (change: Partial<FuelWidgetSettings['config']>) => void;
}

export const PitStrategySection = ({ settings, onChange }: PitStrategySectionProps) => {
  return (
    <div className="space-y-4">
      <h3 className="text-lg font-medium text-slate-200">Pit Strategy</h3>

      <div className="flex items-center justify-between">
        <div>
          <span className="text-sm text-slate-300">Fixed Target Lap</span>
          <span className="block text-xs text-slate-500">Enable a specific lap target for strategy</span>
        </div>
        <ToggleSwitch
          enabled={settings.config.enableTargetPitLap || false}
          onToggle={(val) => onChange({ enableTargetPitLap: val })}
        />
      </div>

      {(settings.config.enableTargetPitLap) && (
        <div className="ml-1 pl-3 border-l-2 border-slate-700/50 space-y-3">
          <div className="flex items-center justify-between pr-2">
            <div>
              <span className="text-sm text-slate-300">Target Pit Lap</span>
              <span className="block text-xs text-slate-500">Scenarios will include this lap as a 4th row. Target message will show fuel required.</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">L</span>
              <input
                type="number"
                min="1"
                max="200"
                value={settings.config.targetPitLap ?? 15}
                onChange={(e) => onChange({ targetPitLap: parseInt(e.target.value) || 1 })}
                className="w-16 px-2 py-1 bg-slate-700 text-slate-200 rounded text-xs text-right focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pr-2">
            <div>
              <span className="text-sm text-slate-300">Calculated From</span>
              <span className="block text-xs text-slate-500">Lap or laps to base the caluclation on.</span>
            </div>
            <select
              value={settings.config.targetPitLapBasis ?? 'avg'}
              onChange={(e) => onChange({ targetPitLapBasis: e.target.value as FuelWidgetSettings['config']['targetPitLapBasis'] })}
              className="px-2 py-1 bg-slate-700 text-slate-200 rounded text-xs"
            >
              <option value="avg">Average ({settings.config.avgLapsCount})</option>
              <option value="avg10">Avg 10 Laps</option>
              <option value="last">Last Lap</option>
              <option value="max">Max Lap</option>
              <option value="min">Min Lap</option>
              <option value="qual">Qualify Max</option>
            </select>
          </div>

        </div>
      )}
      
    </div>
  );
};
