import { useState } from 'react';
import { useFuelStore } from '../../../FuelCalculator/FuelStore';
import { SettingsSection } from '../../components/SettingSection';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import logger from '@irdashies/utils/logger';
import { settingPropFor } from '../../components/SettingProp';

const SettingProp = settingPropFor('fuel');

export const HistoricalStorageSection = () => {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ error: boolean; text: string } | null>(
    null
  );
  const clearHistory = async () => {
    setConfirmOpen(false);
    setPending(true);
    setResult(null);
    try {
      await window.fuelCalculatorBridge.clearAllHistory();
      useFuelStore.getState().clearAllData();
      useFuelStore.getState().setQualifyConsumption(null);
      setResult({ error: false, text: 'Fuel history cleared successfully.' });
    } catch (err) {
      logger.error('Failed to clear fuel history:', err);
      setResult({
        error: true,
        text: 'Failed to clear fuel history. Try again.',
      });
    } finally {
      setPending(false);
    }
  };
  return (
    <SettingsSection title="Historical Storage">
      <SettingProp path="enableStorage" />
      <SettingProp path="enableLogging" />
      <div className="space-y-3 border-t border-slate-700 pt-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex-1">
            <span className="text-sm text-slate-300">Clear Data Storage</span>
            <p className="text-sm text-slate-400">
              Wipe all saved fuel consumption history from the database.
            </p>
          </div>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmOpen(true)}
            className="settings-button-danger"
          >
            {pending ? 'Clearing…' : 'Clear All History'}
          </button>
        </div>
        {result && (
          <p
            role={result.error ? 'alert' : 'status'}
            className={
              result.error ? 'text-sm text-red-300' : 'text-sm text-slate-300'
            }
          >
            {result.text}
          </p>
        )}
      </div>
      <ConfirmDialog
        isOpen={confirmOpen}
        title="Clear all fuel history?"
        message="This deletes all saved fuel consumption history. This cannot be undone."
        confirmText="Clear All History"
        onConfirm={() => void clearHistory()}
        onCancel={() => setConfirmOpen(false)}
      />
    </SettingsSection>
  );
};
