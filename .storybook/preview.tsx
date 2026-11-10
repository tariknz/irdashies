import type { Preview } from '@storybook/react-vite';
import { I18nProvider } from '../src/frontend/i18n';
import type { AppLanguage } from '../src/types';
import '../src/frontend/theme.css';

const preview: Preview = {
  initialGlobals: {
    backgrounds: { value: 'dark' },
    language: 'pt-BR',
  },
  globalTypes: {
    language: {
      description: 'Interface language',
      toolbar: {
        title: 'Language',
        icon: 'globe',
        items: [
          { value: 'pt-BR', title: 'Português (Brasil)' },
          { value: 'en', title: 'English' },
        ],
        dynamicTitle: true,
      },
    },
  },
  decorators: [
    (Story, { globals }) => (
      <I18nProvider language={globals.language as AppLanguage}>
        <Story />
      </I18nProvider>
    ),
  ],
};

export default preview;
