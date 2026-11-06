import { SettingsTabType } from '@irdashies/types';

interface TabButtonProps<Tab extends string = SettingsTabType> {
  id: Tab;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  children: React.ReactNode;
  /** Shown before the label, e.g. a platform logo. */
  icon?: React.ReactNode;
}

export const TabButton = <Tab extends string = SettingsTabType>({
  id,
  activeTab,
  setActiveTab,
  children,
  icon,
}: TabButtonProps<Tab>) => (
  <button
    type="button"
    aria-pressed={activeTab === id}
    onClick={() => setActiveTab(id)}
    className={`inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-t-md px-3 py-2 text-sm font-semibold border-b-2 transition-colors ${
      activeTab === id
        ? 'text-accent-200 border-accent-400 bg-accent-400/10'
        : 'text-slate-400 border-transparent hover:bg-slate-800 hover:text-slate-200'
    }`}
  >
    {icon}
    {children}
  </button>
);
