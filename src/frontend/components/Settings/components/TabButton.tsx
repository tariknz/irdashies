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
    onClick={() => setActiveTab(id)}
    className={`inline-flex items-center justify-center gap-2 px-4 py-2 text-md settings-heading font-semibold border-b-2 transition-colors ${
      activeTab === id
        ? 'text-white border-accent-500'
        : 'text-slate-400 border-transparent hover:text-slate-200'
    }`}
  >
    {icon}
    {children}
  </button>
);
