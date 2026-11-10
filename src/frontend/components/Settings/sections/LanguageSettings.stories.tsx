import { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';
import type { AppLanguage } from '@irdashies/types';
import { I18nProvider, t } from '@irdashies/frontend/i18n';
import { LanguageSettings } from './LanguageSettings';
import { SettingToggleRow } from '../components/SettingToggleRow';
import { TabButton } from '../components/TabButton';

const meta: Meta<typeof LanguageSettings> = {
  component: LanguageSettings,
  title: 'widgets/Settings/LanguageSettings',
};

export default meta;
type Story = StoryObj<typeof meta>;

/** Switching the language re-renders everything below it straight away. */
export const LiveSwitch: Story = {
  render: () => {
    const [language, setLanguage] = useState<AppLanguage>('pt-BR');
    return (
      <I18nProvider language={language}>
        <div className="w-[640px] space-y-4">
          <LanguageSettings value={language} onChange={setLanguage} />
          <div className="flex gap-1 border-b border-slate-700">
            <TabButton
              id="display"
              activeTab="display"
              setActiveTab={() => undefined}
            >
              {t('Display')}
            </TabButton>
            <TabButton
              id="options"
              activeTab="display"
              setActiveTab={() => undefined}
            >
              {t('Options')}
            </TabButton>
            <TabButton
              id="header"
              activeTab="display"
              setActiveTab={() => undefined}
            >
              {t('Header')}
            </TabButton>
          </div>
          <SettingToggleRow
            title={t('Show only when on track')}
            description={t(
              'If enabled, widget will only be shown when driving'
            )}
            enabled
            onToggle={() => undefined}
          />
          <p className="text-sm text-slate-400">
            iRating · SR · DNF · PIT — {t('Standings')}, {t('Relative')},{' '}
            {t('Fuel Calculator')}
          </p>
        </div>
      </I18nProvider>
    );
  },
};

export const English: Story = {
  render: () => {
    const [language, setLanguage] = useState<AppLanguage>('en');
    return (
      <I18nProvider language={language}>
        <div className="w-[640px]">
          <LanguageSettings value={language} onChange={setLanguage} />
        </div>
      </I18nProvider>
    );
  },
};
