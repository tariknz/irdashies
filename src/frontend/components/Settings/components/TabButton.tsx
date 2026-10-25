import { SettingsTabType } from '@irdashies/types';

interface TabButtonProps<Tab extends string = SettingsTabType> {
  id: Tab;
  activeTab: Tab;
  setActiveTab: (tab: Tab) => void;
  children: React.ReactNode;
}

export const TabButton = <Tab extends string = SettingsTabType>({
  id,
  activeTab,
  setActiveTab,
  children,
}: TabButtonProps<Tab>) => (
  <button
    onClick={() => setActiveTab(id)}
    className={`px-4 py-2 text-md settings-heading font-semibold border-b-2 transition-colors ${
      activeTab === id
        ? 'text-white border-accent-500'
        : 'text-slate-400 border-transparent hover:text-slate-200'
    }`}
  >
    {children}
  </button>
);
