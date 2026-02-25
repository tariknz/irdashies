import { FuelWidgetSettings } from '../../types';
import { ToggleSwitch } from '../../components/ToggleSwitch';
import { useFuelStore } from '../../../FuelCalculator/FuelStore';

interface HistoricalStorageSectionProps {
  settings: FuelWidgetSettings;
  onChange: (change: Partial<FuelWidgetSettings['config']>) => void;
}

export const HistoricalStorageSection = ({
  settings,
  onChange,
}: HistoricalStorageSectionProps) => {
  return (
    <div className="space-y-4 border-t border-slate-600/50 pt-6">
      <h3 className="text-lg font-medium text-slate-200">Historical Storage</h3>
      <div className="bg-slate-800/50 p-4 rounded border border-slate-700 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm font-medium text-slate-300">
              Enable Historical Persistence
            </span>
            <span className="block text-xs text-slate-500">
              Saves the last 10 laps for each car/track to provide immediate
              estimates.
            </span>
          </div>
          <ToggleSwitch
            enabled={settings.config.enableStorage ?? true}
            onToggle={(val) => onChange({ enableStorage: val })}
          />
        </div>

        <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
          <div>
            <span className="text-sm font-medium text-slate-300">
              Enable Debug Logging
            </span>
            <span className="block text-xs text-slate-500">
              Log comprehensive data to file for troubleshooting.
            </span>
          </div>
          <ToggleSwitch
            enabled={settings.config.enableLogging ?? false}
            onToggle={(val) => onChange({ enableLogging: val })}
          />
        </div>

        <div className="pt-4 border-t border-slate-700/50">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-sm font-medium text-slate-300 text-red-400">
                Clear Data Storage
              </span>
              <span className="block text-xs text-slate-500">
                Wipe all saved fuel consumption history from the database.
              </span>
            </div>
            <button
              onClick={() => {
                if (
                  confirm(
                    'Are you sure you want to clear ALL fuel history data? This cannot be undone.'
                  )
                ) {
                  window.fuelCalculatorBridge
                    .clearAllHistory()
                    .then(() => {
                      // Also clear the frontend store memory
                      useFuelStore.getState().clearAllData();
                      useFuelStore.getState().setQualifyConsumption(null);
                      alert('Fuel history cleared successfully.');
                    })
                    .catch((err) => {
                      console.error('Failed to clear fuel history:', err);
                      alert('Failed to clear fuel history.');
                    });
                }
              }}
              className="px-3 py-1 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded text-xs transition-colors"
            >
              Clear All History
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
