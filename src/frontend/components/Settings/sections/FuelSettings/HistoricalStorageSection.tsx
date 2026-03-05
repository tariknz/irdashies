import { FuelWidgetSettings } from '../../types';
import { useFuelStore } from '../../../FuelCalculator/FuelStore';
import { SettingToggleRow } from '../../components/SettingToggleRow';
import { SettingsSection } from '../../components/SettingSection';

interface HistoricalStorageSectionProps {
  settings: FuelWidgetSettings;
  onChange: (change: Partial<FuelWidgetSettings['config']>) => void;
}

export const HistoricalStorageSection = ({
  settings,
  onChange,
}: HistoricalStorageSectionProps) => {
  return (
    <SettingsSection title="Historical Storage">
        
        <SettingToggleRow
          title="Enable Historical Persistence"
          description="Saves the last 10 laps for each car/track to provide immediate
              estimates."
          enabled={settings.config.enableStorage ?? false}
          onToggle={(newValue) =>
            onChange({ enableStorage: newValue })
          }
        /> 

        <SettingToggleRow
          title="Enable Debug Logging"
          description="Log comprehensive data to file for troubleshooting."
          enabled={settings.config.enableLogging ?? false}
          onToggle={(newValue) =>
            onChange({ enableLogging: newValue })
          }
        /> 

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

    </SettingsSection>
  );
};
