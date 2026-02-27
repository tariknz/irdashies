import { SettingsTabType } from '../types';

 interface TabButtonProps {
  id: SettingsTabType;
  activeTab: SettingsTabType;
  setActiveTab: (tab: SettingsTabType) => void;
  children: React.ReactNode;
};

export const TabButton = ({ id, activeTab, setActiveTab, children }: TabButtonProps) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`px-4 py-2 text-sm border-b-2 transition-colors ${
        activeTab === id
          ? 'text-white border-blue-500'
          : 'text-slate-400 border-transparent hover:text-slate-200'
      }`}
    >
      {children}
    </button>
  );