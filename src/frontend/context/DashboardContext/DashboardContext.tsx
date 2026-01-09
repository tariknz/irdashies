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
  profileId?: string;
}> = ({ bridge, children, profileId }) => {
  const [dashboard, setDashboard] = useState<DashboardLayout>();
  const [editMode, setEditMode] = useState(false);
  const [version, setVersion] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [currentProfile, setCurrentProfile] = useState<DashboardProfile | null>(null);
  const [profiles, setProfiles] = useState<DashboardProfile[]>([]);

  // Store the initial profileId from URL to always use it
  const initialProfileIdRef = React.useRef(profileId);

  const loadProfiles = React.useCallback(async (specificProfileId?: string) => {
    console.log('[DashboardContext] Loading profiles at', new Date().toISOString());
    const allProfiles = await bridge.listProfiles();
    console.log('[DashboardContext] Loaded profiles:', JSON.stringify(allProfiles, null, 2));
    setProfiles(allProfiles);

    // Always use the initial profileId from URL if it was provided
    const profileIdToUse = specificProfileId || initialProfileIdRef.current;

    // If a specific profile ID is provided, use that; otherwise get current profile
    let profileToLoad: DashboardProfile | null;
    if (profileIdToUse) {
      console.log('[DashboardContext] Loading specific profile:', profileIdToUse);
      profileToLoad = allProfiles.find(p => p.id === profileIdToUse) || null;
      if (!profileToLoad) {
        console.warn('[DashboardContext] Profile not found:', profileIdToUse, '- falling back to current');
        // Profile doesn't exist - clear the ref so we don't stay locked
        initialProfileIdRef.current = undefined;
        profileToLoad = await bridge.getCurrentProfile();
      }
    } else {
      profileToLoad = await bridge.getCurrentProfile();
    }

    console.log('[DashboardContext] Profile to load:', JSON.stringify(profileToLoad, null, 2));
    // Deep clone to ensure React detects nested changes
    setCurrentProfile(profileToLoad ? JSON.parse(JSON.stringify(profileToLoad)) : null);
  }, [bridge]);

  useEffect(() => {
    console.log('📊 DashboardProvider mounted');
    console.log('📊 Initial profileId from URL:', profileId);
    console.log('📊 initialProfileIdRef.current:', initialProfileIdRef.current);

    bridge.dashboardUpdated((dashboard) => {
      console.log('📊 Dashboard received from bridge:', dashboard);
      console.log('📊 initialProfileIdRef.current at callback:', initialProfileIdRef.current);
      
      // For profile-specific URLs, we need to ensure we're getting the right profile's dashboard
      if (initialProfileIdRef.current && bridge.getDashboardForProfile) {
        console.log('📊 Locked to profile', initialProfileIdRef.current, '- reloading that profile\'s dashboard');
        bridge.getDashboardForProfile(initialProfileIdRef.current).then((profileDashboard) => {
          if (profileDashboard) {
            // Only update if the dashboard is actually different to avoid overwriting local optimistic updates
            setDashboard(prev => {
              if (JSON.stringify(prev) !== JSON.stringify(profileDashboard)) {
                return profileDashboard;
              }
              return prev;
            });
          }
        });
      } else {
        // Only update if the dashboard is actually different to avoid overwriting local optimistic updates
        setDashboard(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(dashboard)) {
            return dashboard;
          }
          return prev;
        });
      }

      // Refresh profiles when dashboard updates to pick up theme changes
      // Use the stored initial profileId to maintain the URL-specified profile
      loadProfiles().catch((err) => console.error('Failed to refresh profiles on dashboard update:', err));
    });

    // If we have a specific profileId from URL, load that profile's dashboard
    if (profileId && bridge.getDashboardForProfile) {
      console.log('📊 Loading dashboard for specific profile:', profileId);
      bridge.getDashboardForProfile(profileId).then((dashboard) => {
        if (dashboard) {
          setDashboard(dashboard);
        } else {
          console.warn('📊 No dashboard returned for profile:', profileId);
          // Fall back to reloading the current dashboard
          bridge.reloadDashboard();
        }
      }).catch((error) => {
        console.error('📊 Error loading dashboard for profile:', profileId, error);
        // Fall back to reloading the current dashboard
        bridge.reloadDashboard();
      });
    } else {
      bridge.reloadDashboard();
    }

    bridge.onEditModeToggled((editMode) => setEditMode(editMode));
    bridge.getAppVersion?.().then((version) => setVersion(version));
    bridge.onDemoModeChanged?.((demoMode) => setIsDemoMode(demoMode));

    return () => {
      bridge.stop();
    };
  }, [bridge, profileId, loadProfiles]);

  // Load profiles after mount to avoid cascading renders
  useEffect(() => {
    // Use setTimeout to defer setState calls and avoid cascading renders
    const timeoutId = setTimeout(() => {
      loadProfiles(profileId);
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [loadProfiles, profileId]);

  const saveDashboard = (
    dashboard: DashboardLayout,
    options?: SaveDashboardOptions
  ) => {
    // Immediately update local state for responsive UI
    setDashboard(dashboard);
    
    // Then save to bridge
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
