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
  GeneralSettingsType,
  SaveDashboardOptions,
  ContainerBoundsInfo,
} from '@irdashies/types';

interface DashboardContextProps {
  editMode: boolean;
  currentDashboard: DashboardLayout | undefined;
  onDashboardUpdated?: (
    dashboard: DashboardLayout,
    options?: SaveDashboardOptions
  ) => void;
  resetDashboard: (resetEverything: boolean) => Promise<DashboardLayout>;
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
}> = ({ bridge, children }) => {
  const [dashboard, setDashboard] = useState<DashboardLayout>();
  const [editMode, setEditMode] = useState(false);
  const [version, setVersion] = useState('');
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [containerBoundsInfo, setContainerBoundsInfo] =
    useState<ContainerBoundsInfo | null>(null);

  useEffect(() => {
    bridge.reloadDashboard();
    const unsubDashboard = bridge.dashboardUpdated((dashboard) => {
      setDashboard(dashboard);
    });
    const unsubEditMode = bridge.onEditModeToggled((editMode) =>
      setEditMode(editMode)
    );
    bridge.getAppVersion?.().then((version) => setVersion(version));
    const unsubDemoMode = bridge.onDemoModeChanged?.((demoMode) =>
      setIsDemoMode(demoMode)
    );
    const unsubContainerBounds = bridge.onContainerBoundsInfo?.((info) => {
      console.log('[DashboardContext] Container bounds info received:', info);
      setContainerBoundsInfo(info);
    });

    return () => {
      if (unsubDashboard) unsubDashboard();
      if (unsubEditMode) unsubEditMode();
      if (unsubDemoMode) unsubDemoMode();
      if (unsubContainerBounds) unsubContainerBounds();
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
        onDashboardUpdated: saveDashboard,
        resetDashboard,
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
    throw new Error('useTelemetry must be used within a TelemetryProvider');
  }
  return context;
};

export const useGeneralSettings = (): GeneralSettingsType | undefined => {
  const { currentDashboard } = useDashboard();
  return currentDashboard?.generalSettings;
};
