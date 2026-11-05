import { memo, useState } from 'react';
import {
  getSettingsLanguage,
  setSettingsLanguage,
  type SettingsLanguage,
} from './language';

export interface LanguageSelectProps {
  reload?: () => void;
}

const defaultReload = () => window.location.reload();

export const LanguageSelect = memo(
  ({ reload = defaultReload }: LanguageSelectProps) => {
    const [language] = useState<SettingsLanguage>(getSettingsLanguage);

    const handleChange = (next: SettingsLanguage) => {
      if (next === language) return;
      setSettingsLanguage(next);
      reload();
    };

    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-medium text-slate-200">Language</h3>
        </div>
        <p className="text-sm text-slate-400">
          Language of the settings window. Overlays stay in English.
        </p>
        <div className="mt-4">
          <select
            translate="no"
            value={language}
            onChange={(e) => handleChange(e.target.value as SettingsLanguage)}
            className="w-full px-3 py-2 bg-slate-700 text-slate-300 rounded border border-slate-600 focus:border-accent-500 focus:outline-none focus:ring-1 focus:ring-accent-500"
          >
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </div>
      </div>
    );
  }
);
LanguageSelect.displayName = 'LanguageSelect';
