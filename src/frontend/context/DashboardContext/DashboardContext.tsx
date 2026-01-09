import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from 'react';
import type {
  DashboardBridge,
  DashboardLayout,
  DashboardProfile,
  GeneralSettingsType,
  SaveDashboardOptions,
} from '@irdashies/types';

interface DashboardContextProps {
  editMode: boolean;
  currentDashboard: DashboardLayout | undefined;
  currentProfile: DashboardProfile | null;
  profiles: DashboardProfile[];
  onDashboardUpdated?: (
    dashboard: DashboardLayout,
    options?: SaveDashboardOptions
  ) => void;
  resetDashboard: (resetEverything: boolean) => Promise<DashboardLayout>;
  createProfile: (name: string) => Promise<DashboardProfile>;
  deleteProfile: (profileId: string) => Promise<void>;
  renameProfile: (profileId: string, newName: string) => Promise<void>;
  switchProfile: (profileId: string) => Promise<void>;
  refreshProfiles: () => Promise<void>;
  bridge: DashboardBridge;
  version: string;
  isDemoMode: boolean;
  toggleDemoMode: () => void;
}

const DashboardContext = createContext<DashboardContextProps | undefined>(
  undefined
);

export const DashboardProvider: React.FC<{
  bridge: DashboardBridge;
  children: ReactNode;
}> = ({ bridge, children }) => {
  const [dashboard, setDashboard] = useState<DashboardLayout>();
  const [editMode, setEditMode] = useState(false);
  const [version, setVersion] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<DashboardProfile | null>(null);
  const [profiles, setProfiles] = useState<DashboardProfile[]>([]);

  const loadProfiles = async () => {
    const allProfiles = await bridge.listProfiles();
    setProfiles(allProfiles);
    const current = await bridge.getCurrentProfile();
    setCurrentProfile(current);
  };

  useEffect(() => {
    console.log('📊 DashboardProvider mounted');
    bridge.reloadDashboard();
    bridge.dashboardUpdated((dashboard) => {
      setDashboard(dashboard);
    });
    bridge.onEditModeToggled((editMode) => setEditMode(editMode));
    bridge.getAppVersion?.().then((version) => setVersion(version));
    bridge.onDemoModeChanged?.((demoMode) => setIsDemoMode(demoMode));

    // Load profiles
    loadProfiles();

    return () => {
      bridge.stop();
    };
  }, [bridge]);

  const saveDashboard = (
    dashboard: DashboardLayout,
    options?: SaveDashboardOptions
  ) => {
    bridge.saveDashboard(dashboard, options);
  };

  const resetDashboard = async (resetEverything: boolean) => {
    const result = await bridge.resetDashboard(resetEverything);
    setDashboard(result);
    return result;
  };

  const createProfile = async (name: string) => {
    const profile = await bridge.createProfile(name);
    await loadProfiles();
    return profile;
  };

  const deleteProfile = async (profileId: string) => {
    await bridge.deleteProfile(profileId);
    await loadProfiles();
  };

  const renameProfile = async (profileId: string, newName: string) => {
    await bridge.renameProfile(profileId, newName);
    await loadProfiles();
  };

  const switchProfile = async (profileId: string) => {
    await bridge.switchProfile(profileId);
    await loadProfiles();
    bridge.reloadDashboard();
  };

  const refreshProfiles = async () => {
    await loadProfiles();
  };

  const toggleDemoMode = () => {
    const newDemoMode = !isDemoMode;
    setIsDemoMode(newDemoMode);
    // Notify the bridge about demo mode change
    bridge.toggleDemoMode?.(newDemoMode);
  };

  return (
    <DashboardContext.Provider
      value={{
        editMode: editMode,
        currentDashboard: dashboard,
        currentProfile,
        profiles,
        onDashboardUpdated: saveDashboard,
        resetDashboard,
        createProfile,
        deleteProfile,
        renameProfile,
        switchProfile,
        refreshProfiles,
        bridge,
        version,
        isDemoMode,
        toggleDemoMode,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = (): DashboardContextProps => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return context;
};

export const useGeneralSettings = (): GeneralSettingsType | undefined => {
  const { currentDashboard } = useDashboard();
  return currentDashboard?.generalSettings;
};
