import { useFuelStore } from '../../../FuelCalculator/FuelStore';
import { SettingsSection } from '../../components/SettingSection';
import logger from '@irdashies/utils/logger';
import { SettingProp } from '../../components/SettingProp';

export const HistoricalStorageSection = () => {
  return (
    <SettingsSection title="Historical Storage">
      <SettingProp path="enableStorage" />

      <SettingProp path="enableLogging" />

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
                    logger.error('Failed to clear fuel history:', err);
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
