import type { ReactNode } from 'react';

export const STICKY_TAB_BAR_CLASS = 'sticky top-0 z-10 bg-slate-900';

export const SettingsTabBar = ({ children }: { children: ReactNode }) => (
  <div
    className={`${STICKY_TAB_BAR_CLASS} flex flex-wrap gap-1 border-b border-slate-700 pb-1`}
  >
    {children}
  </div>
);
