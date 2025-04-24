import React, {
  createContext,
  useContext,
  useState,
  ReactNode,
  useEffect,
} from 'react';
import type { DashboardBridge, DashboardLayout } from '@irdashies/types';

interface DashboardContextProps {
  editMode: boolean;
  currentDashboard: DashboardLayout | undefined;
  onDashboardUpdated?: (dashboard: DashboardLayout) => void;
  bridge: DashboardBridge;
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

  useEffect(() => {
    bridge.reloadDashboard();
    bridge.dashboardUpdated((dashboard) => setDashboard(dashboard));
    bridge.onEditModeToggled((editMode) => setEditMode(editMode));
  }, [bridge]);

  const saveDashboard = (dashboard: DashboardLayout) => {
    bridge.saveDashboard(dashboard);
  };

  return (
    <DashboardContext.Provider
      value={{
        editMode: editMode,
        currentDashboard: dashboard,
        onDashboardUpdated: saveDashboard,
        bridge,
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
