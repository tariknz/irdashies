import { PropsWithChildren } from 'react';
import { useGeneralSettings } from '@irdashies/context';
import { useLocation } from 'react-router-dom';

export const ThemeManager = ({ children }: PropsWithChildren) => {
  const { fontSize } = useGeneralSettings() || {};
  const location = useLocation();

  if (location.pathname.startsWith('/settings')) {
    return <>{children}</>;
  }

  return <div className={`relative w-full h-full overlay-window overlay-theme-${fontSize ?? 'sm'}`}>{children}</div>;
};
