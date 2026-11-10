import type { PropsWithChildren } from 'react';
import { useGeneralSettings } from '@irdashies/context';
import { I18nProvider } from './I18nProvider';

/**
 * Follows the language chosen in App settings (general settings). Saved
 * dashboards always carry one (the default is Portuguese); a dashboard
 * without it, such as a Storybook mock, leaves the active language alone.
 */
export const LanguageSync = ({ children }: PropsWithChildren) => {
  const language = useGeneralSettings()?.language;
  if (!language) return <>{children}</>;
  return <I18nProvider language={language}>{children}</I18nProvider>;
};
