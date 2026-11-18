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
  ContainerBoundsInfo,
} from '@irdashies/types';
import logger from '@irdashies/utils/logger';

type DashboardUpdate =
  DashboardLayout | ((dashboard: DashboardLayout) => DashboardLayout);

interface DashboardState {
  dashboard: DashboardLayout;
  profileId?: string;
}

interface DashboardContextProps {
  editMode: boolean;
  currentDashboard: DashboardLayout | undefined;
  currentProfile: DashboardProfile | null;
  profiles: DashboardProfile[];
  onDashboardUpdated?: (
    update: DashboardUpdate,
    options?: SaveDashboardOptions
  ) => void;
  resetDashboard: (resetEverything: boolean) => Promise<DashboardLayout>;
  createProfile: (name: string) => Promise<DashboardProfile>;
  cloneProfile: (profileId: string) => Promise<DashboardProfile>;
  deleteProfile: (profileId: string) => Promise<void>;
  renameProfile: (profileId: string, newName: string) => Promise<void>;
  switchProfile: (profileId: string) => Promise<void>;
  refreshProfiles: () => Promise<void>;
  bridge: DashboardBridge;
  version: string;
  isDemoMode: boolean;
  toggleDemoMode: () => void;
  containerBoundsInfo: ContainerBoundsInfo | null;
}

const DashboardContext = createContext<DashboardContextProps | undefined>(
  undefined
);

export const DashboardProvider: React.FC<{
  bridge: DashboardBridge;
  children: ReactNode;
  profileId?: string;
}> = ({ bridge, children, profileId }) => {
  const [dashboardState, setDashboardState] = useState<DashboardState>();
  const latestDashboard = React.useRef<DashboardState | undefined>(undefined);
  const pendingProfile = React.useRef<string | undefined>(undefined);
  const saveSource = React.useRef<string | undefined>(undefined);
  const saveSequence = React.useRef(0);
  const setDashboard = React.useCallback(
    (dashboard: DashboardLayout, updatedProfileId?: string) => {
      const state = { dashboard, profileId: updatedProfileId };
      latestDashboard.current = state;
      setDashboardState(state);
    },
    []
  );
  const [editMode, setEditMode] = useState(false);
  const [version, setVersion] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [containerBoundsInfo, setContainerBoundsInfo] =
    useState<ContainerBoundsInfo | null>(null);
  const [currentProfile, setCurrentProfile] = useState<DashboardProfile | null>(
    null
  );
  const [profiles, setProfiles] = useState<DashboardProfile[]>([]);

  // Store the initial profileId from URL to always use it
  const initialProfileIdRef = React.useRef(profileId);

  const loadProfiles = React.useCallback(
    async (specificProfileId?: string) => {
      const allProfiles = await bridge.listProfiles();
      setProfiles(allProfiles);

      // Always use the initial profileId from URL if it was provided
      const profileIdToUse = specificProfileId || initialProfileIdRef.current;

      // If a specific profile ID is provided, use that; otherwise get current profile
      let profileToLoad: DashboardProfile | null;
      if (profileIdToUse) {
        profileToLoad =
          allProfiles.find((p) => p.id === profileIdToUse) || null;
        if (!profileToLoad) {
          // For browser views with a specific profileId, create a minimal profile object
          // The profile exists, but might not be in the active list
          if (initialProfileIdRef.current === profileIdToUse) {
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
      setCurrentProfile(
        profileToLoad ? JSON.parse(JSON.stringify(profileToLoad)) : null
      );
    },
    [bridge]
  );

  useEffect(() => {
    const unsubDashboard = bridge.dashboardUpdated(
      (updatedDashboard, updatedProfileId, saveId) => {
        const source = saveSource.current;
        if (
          source &&
          saveId?.startsWith(source) &&
          (saveId !== `${source}${saveSequence.current}` ||
            (updatedProfileId !== undefined &&
              latestDashboard.current?.profileId !== undefined &&
              updatedProfileId !== latestDashboard.current.profileId))
        ) {
          return;
        }

        const contextProfileId = initialProfileIdRef.current;

        // If this context is for a specific profile (i.e., a browser view)
        if (contextProfileId) {
          // Only accept updates that are specifically for our profile
          if (updatedProfileId === contextProfileId) {
            setDashboard(updatedDashboard, updatedProfileId);
          }
        } else {
          // Otherwise, this is the main Electron app context, so we should accept any update
          setDashboard(updatedDashboard, updatedProfileId);
        }

        // Refresh profiles to pick up on theme changes etc.
        loadProfiles().catch((err) =>
          logger.error('Failed to refresh profiles on dashboard update:', err)
        );
      }
    );

    // Initial load logic
    if (profileId && bridge.getDashboardForProfile) {
      bridge
        .getDashboardForProfile(profileId)
        .then((dashboard) => {
          if (dashboard) {
            setDashboard(dashboard, profileId);
          } else {
            // Fallback for safety, should not be hit in normal operation
            bridge.reloadDashboard();
          }
        })
        .catch((error) => {
          logger.error(
            'Error loading dashboard for profile:',
            profileId,
            error
          );
          bridge.reloadDashboard();
        });
    } else {
      // This is the path for the main Electron app, which doesn't have a profileId prop
      bridge.reloadDashboard();
    }

    const unsubEditMode = bridge.onEditModeToggled((editMode) =>
      setEditMode(editMode)
    );
    bridge.getAppVersion?.().then((version) => setVersion(version));
    // Toggling demo mode can rebuild the overlay windows after the change
    // was announced, so a new window asks for the current state; an event
    // that lands first is newer than the answer and wins.
    let demoModeHeard = false;
    const unsubDemoMode = bridge.onDemoModeChanged?.((demoMode) => {
      demoModeHeard = true;
      setIsDemoMode(demoMode);
    });
    bridge.getIsDemoMode?.().then((demoMode) => {
      if (!demoModeHeard) setIsDemoMode(demoMode);
    });
    const unsubContainerBounds = bridge.onContainerBoundsInfo?.((info) => {
      setContainerBoundsInfo(info);
    });

    // Cleanup
    return () => {
      if (unsubDashboard) unsubDashboard();
      if (unsubEditMode) unsubEditMode();
      if (unsubDemoMode) unsubDemoMode();
      if (unsubContainerBounds) unsubContainerBounds();
      bridge.stop();
    };
  }, [bridge, profileId, loadProfiles, setDashboard]);

  // Load profiles after mount to avoid cascading renders
  useEffect(() => {
    // Use setTimeout for all cases to avoid cascading renders
    // For browser views, use immediate tick (0ms), for main app use deferred
    const timeoutId = setTimeout(() => {
      loadProfiles(profileId);
    }, 0);

    return () => clearTimeout(timeoutId);
  }, [loadProfiles, profileId]);

  const saveDashboard = (
    update: DashboardUpdate,
    options?: SaveDashboardOptions
  ) => {
    const latest = latestDashboard.current;
    const renderedProfileId = dashboardState?.profileId ?? currentProfile?.id;
    const targetProfileId = options?.profileId ?? renderedProfileId;
    if (
      (pendingProfile.current && pendingProfile.current !== targetProfileId) ||
      (latest?.profileId && latest.profileId !== targetProfileId)
    ) {
      return;
    }
    let dashboard: DashboardLayout;
    if (typeof update === 'function') {
      if (!latest) return;
      dashboard = update(latest.dashboard);
      if (dashboard === latest.dashboard) return;
    } else {
      dashboard = update;
    }
    const source =
      (saveSource.current ??= `${crypto.getRandomValues(new Uint32Array(4)).join('-')}:`);
    const saveId = `${source}${++saveSequence.current}`;
    setDashboard(dashboard, targetProfileId);
    bridge.saveDashboard(dashboard, {
      ...options,
      profileId: targetProfileId,
      saveId,
    });
  };

  const resetDashboard = async (resetEverything: boolean) => {
    const result = await bridge.resetDashboard(resetEverything);
    const renderedProfileId = dashboardState?.profileId ?? currentProfile?.id;
    if (latestDashboard.current?.profileId === renderedProfileId) {
      setDashboard(result, renderedProfileId);
    }
    return result;
  };

  const createProfile = async (name: string) => {
    const profile = await bridge.createProfile(name);
    await loadProfiles();
    return profile;
  };

  const cloneProfile = async (profileId: string) => {
    const profile = await bridge.cloneProfile(profileId);
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
    pendingProfile.current = profileId;
    try {
      await bridge.switchProfile(profileId);
      await loadProfiles();

      if (bridge.getDashboardForProfile) {
        try {
          const newDashboard = await bridge.getDashboardForProfile(profileId);
          if (newDashboard && pendingProfile.current === profileId) {
            setDashboard(newDashboard, profileId);
          }
        } catch (error) {
          logger.error(
            'Failed to load dashboard for profile:',
            profileId,
            error
          );
        }
      }

      bridge.reloadDashboard();
    } finally {
      if (pendingProfile.current === profileId) {
        pendingProfile.current = undefined;
      }
    }
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
        currentDashboard: dashboardState?.dashboard,
        currentProfile,
        profiles,
        onDashboardUpdated: saveDashboard,
        resetDashboard,
        createProfile,
        cloneProfile,
        deleteProfile,
        renameProfile,
        switchProfile,
        refreshProfiles,
        bridge,
        version,
        isDemoMode,
        toggleDemoMode,
        containerBoundsInfo,
      }}
    >
      {children}
    </DashboardContext.Provider>
  );
};

export const useDashboard = (): DashboardContextProps => {
  const context = useContext(DashboardContext);
  if (!context) {
    throw new Error('useDashboard must be used within a DashboardProvider');
  }
  return context;
};

/**
 * The dashboard bridge, without requiring a provider.
 *
 * The browser view hands its WebSocket bridge to DashboardProvider and never
 * assigns window.dashboardBridge, so a hook reading only the global sees
 * nothing there and reports every answer as unavailable. Hooks that also run
 * outside a provider fall back to the global, which is what the Electron
 * renderers have.
 */
export const useDashboardBridge = (): DashboardBridge | undefined => {
  const context = useContext(DashboardContext);
  return context?.bridge ?? window.dashboardBridge;
};

export const useGeneralSettings = (): GeneralSettingsType | undefined => {
  const { currentDashboard } = useDashboard();
  return currentDashboard?.generalSettings;
};
