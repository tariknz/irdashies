import type { AppLanguage } from '@irdashies/types';
import { SUPPORTED_LANGUAGES, t } from '@irdashies/frontend/i18n';
import { SettingSelectRow } from '../components/SettingSelectRow';

interface LanguageSettingsProps {
  value: AppLanguage;
  onChange: (language: AppLanguage) => void;
}

/** Interface language picker shown at the top of App settings > General. */
export const LanguageSettings = ({
  value,
  onChange,
}: LanguageSettingsProps) => (
  <section className="space-y-5 rounded-lg border border-slate-700 bg-slate-800/40 p-4">
    <SettingSelectRow<AppLanguage>
      title={t('Language')}
      description={t(
        'Language of the settings window and the text inside the overlays. Changes apply straight away, no restart needed.'
      )}
      value={value}
      // Each language is named in its own language so it can be found from
      // either one; those names have no translation entry.
      options={SUPPORTED_LANGUAGES.map(({ value, label }) => ({
        value,
        label,
      }))}
      onChange={onChange}
    />
  </section>
);
