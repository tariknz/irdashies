import { useEffect, useState } from 'react';
import {
  GearIcon,
  LockIcon,
  PresentationChartIcon,
} from '@phosphor-icons/react';
import {
  Route,
  Routes,
  Navigate,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import { useDashboard } from '@irdashies/context';
import { SettingsLoader } from './SettingsLoader';
import { SettingsMenu } from './SettingsMenu';

export const SettingsLayout = () => {
  const {
    bridge,
    isDemoMode,
    toggleDemoMode,
    currentDashboard,
    currentProfile,
  } = useDashboard();
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const [editModeAccelerator, setEditModeAccelerator] = useState('F6');

  useEffect(() => {
    window.keybindingsBridge?.getKeybindings().then((bindings) => {
      setEditModeAccelerator(bindings['toggle-edit-mode'].accelerator);
    });
  }, [pathname]);

  useEffect(() => {
    const unsub = window.dashboardBridge?.onNavigateToSettings?.(
      (widgetType) => {
        navigate(`/settings/${widgetType}`);
      }
    );
    return () => unsub?.();
  }, [navigate]);

  const handleToggleLock = async () => {
    await bridge.toggleLockOverlays();
  };

  if (!currentDashboard) {
    return <>Loading...</>;
  }

  return (
    <div className="flex flex-col gap-4 bg-slate-700 p-4 rounded-md w-full h-full">
      <div className="flex flex-row gap-4 items-center justify-between">
        <div className="flex flex-row gap-4 items-center">
          <GearIcon size={32} weight="bold" />
          <div>
            <h1 className="text-2xl font-bold">Overlay Settings</h1>
            {currentProfile && (
              <p className="text-sm text-slate-300">
                {currentProfile.name} Profile
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-row gap-2">
          <button
            onClick={toggleDemoMode}
            className="flex flex-row gap-1.5 items-center px-3 py-2 rounded bg-slate-800 hover:bg-slate-600 transition-colors"
          >
            {isDemoMode ? (
              <>
                <PresentationChartIcon size={20} weight="bold" />
                <span>Exit Demo</span>
              </>
            ) : (
              <>
                <PresentationChartIcon size={20} weight="bold" />
                <span>Demo Mode</span>
              </>
            )}
          </button>
          <button
            onClick={handleToggleLock}
            className="flex flex-row gap-1.5 items-center px-3 py-2 rounded bg-slate-800 hover:bg-slate-600 transition-colors"
          >
            <LockIcon size={20} weight="bold" />
            <span>Edit Layout</span>
            <kbd className="ml-1 text-xs bg-black/20 px-1 rounded">
              {editModeAccelerator}
            </kbd>
          </button>
        </div>
      </div>
      <div className="flex flex-row gap-4 flex-1 min-h-0 text-sm">
        {/* Left Column - Widget Menu */}
        <SettingsMenu />

        {/* Right Column - Widget Settings */}
        <div className="w-3/4 bg-slate-800 p-4 rounded-md flex flex-col overflow-hidden">
          <Routes>
            <Route
              path="/"
              element={<Navigate to="/settings/general" replace />}
            />
            <Route path="/:widgetId" element={<SettingsLoader />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};
