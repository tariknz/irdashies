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
  
  console.log('[DashboardContext] Initialized with profileId from props:', profileId, 'initialProfileIdRef:', initialProfileIdRef.current);

  const loadProfiles = React.useCallback(async (specificProfileId?: string) => {
    const allProfiles = await bridge.listProfiles();
    setProfiles(allProfiles);

    // Always use the initial profileId from URL if it was provided
    const profileIdToUse = specificProfileId || initialProfileIdRef.current;
    
    console.log('[DashboardContext.loadProfiles] Loading profiles. specificProfileId:', specificProfileId, 'initialProfileIdRef.current:', initialProfileIdRef.current, 'profileIdToUse:', profileIdToUse);

    // If a specific profile ID is provided, use that; otherwise get current profile
    let profileToLoad: DashboardProfile | null;
    if (profileIdToUse) {
      profileToLoad = allProfiles.find(p => p.id === profileIdToUse) || null;
      if (!profileToLoad) {
        console.warn('[DashboardContext] Profile not found in list:', profileIdToUse, '- it may be a non-active profile, but we will still use it');
        // For browser views with a specific profileId, create a minimal profile object
        // The profile exists, but might not be in the active list
        if (initialProfileIdRef.current === profileIdToUse) {
          console.log('[DashboardContext] Using profileId from URL despite not being in active list:', profileIdToUse);
          profileToLoad = {
            id: profileIdToUse,
            name: profileIdToUse, // Use ID as name until we can fetch the real name
            createdAt: new Date().toISOString(),
            lastModified: new Date().toISOString(),
          };
        } else {
          // This is a different profile, fall back to current
          profileToLoad = await bridge.getCurrentProfile();
        }
      }
    } else {
      profileToLoad = await bridge.getCurrentProfile();
    }

    // Deep clone to ensure React detects nested changes
    console.log('[DashboardContext.loadProfiles] Setting currentProfile to:', profileToLoad?.id);
    setCurrentProfile(profileToLoad ? JSON.parse(JSON.stringify(profileToLoad)) : null);
  }, [bridge]);

  useEffect(() => {
    bridge.dashboardUpdated((dashboard, updatedProfileId) => {
      const contextProfileId = initialProfileIdRef.current;

      // If this context is for a specific profile (i.e., a browser view)
      if (contextProfileId) {
        // Only accept updates that are specifically for our profile
        if (updatedProfileId === contextProfileId) {
          setDashboard(dashboard);
        }
      } else {
        // Otherwise, this is the main Electron app context, so we should accept any update
        setDashboard(dashboard);
      }
      
      // Refresh profiles to pick up on theme changes etc.
      loadProfiles().catch((err) => console.error('Failed to refresh profiles on dashboard update:', err));
    });

    // Initial load logic
    if (profileId && bridge.getDashboardForProfile) {
      bridge.getDashboardForProfile(profileId).then((dashboard) => {
        if (dashboard) {
          setDashboard(dashboard);
        } else {
          // Fallback for safety, should not be hit in normal operation
          bridge.reloadDashboard();
        }
      }).catch((error) => {
        console.error('Error loading dashboard for profile:', profileId, error);
        bridge.reloadDashboard();
      });
    } else {
      // This is the path for the main Electron app, which doesn't have a profileId prop
      bridge.reloadDashboard();
    }

    // Set up other listeners
    bridge.onEditModeToggled((editMode) => setEditMode(editMode));
    bridge.getAppVersion?.().then((version) => setVersion(version));
    bridge.onDemoModeChanged?.((demoMode) => setIsDemoMode(demoMode));

    // Cleanup
    return () => {
      bridge.stop();
    };
  }, [bridge, profileId, loadProfiles]);

  // Load profiles after mount to avoid cascading renders
  useEffect(() => {
    // For browser views with a profileId, load profiles immediately to ensure currentProfile is available
    // For main app, load after a tick to avoid cascading renders
    if (profileId) {
      // Browser view: load synchronously since we know the profileId
      loadProfiles(profileId);
    } else {
      // Main app: use setTimeout to defer setState calls and avoid cascading renders
      const timeoutId = setTimeout(() => {
        loadProfiles();
      }, 0);

      return () => clearTimeout(timeoutId);
    }
  }, [loadProfiles, profileId]);

  const saveDashboard = (
    dashboard: DashboardLayout,
    options?: SaveDashboardOptions
  ) => {
    // Immediately update local state for responsive UI
    setDashboard(dashboard);
    
    // Ensure we save to the current profile by adding profileId to options
    const saveOptions = {
      ...options,
      profileId: options?.profileId || currentProfile?.id
    };
    
    // Then save to bridge
    bridge.saveDashboard(dashboard, saveOptions);
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
    
    // Force reload dashboard for the new profile
    if (bridge.getDashboardForProfile) {
      try {
        const newDashboard = await bridge.getDashboardForProfile(profileId);
        if (newDashboard) {
          setDashboard(newDashboard);
        }
      } catch (error) {
        console.error('Failed to load dashboard for profile:', profileId, error);
      }
    }
    
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
