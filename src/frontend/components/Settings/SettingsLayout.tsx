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
import {
  useActiveSimulator,
  useDashboard,
  useRunningState,
} from '@irdashies/context';
import { simulatorDisplayName } from '@irdashies/types';
import { SettingsLoader } from './SettingsLoader';
import { SettingsMenu } from './SettingsMenu';
import { ReleaseNotesStatusProvider } from './ReleaseNotes/ReleaseNotesStatusContext';
import { ReleaseNotesAnnouncement } from './ReleaseNotes/ReleaseNotesAnnouncement';

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
  const activeSimulator = useActiveSimulator();
  const { running } = useRunningState();
  // The name says which sim is feeding the overlays, so it has no business
  // being up when none is. The active simulator is deliberately not cleared on
  // a disconnect -- that drives widget filtering and would rebuild every
  // overlay window -- so the running state is what gates the display.
  const simulatorName = running ? simulatorDisplayName(activeSimulator) : null;

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
    <ReleaseNotesStatusProvider>
      <div className="flex flex-col gap-4 bg-slate-700 p-4 w-full h-full">
        <ReleaseNotesAnnouncement />
        {/* The window has no native title bar: this row is the drag handle, and
          the right padding keeps clear of the OS min/max/close buttons. Their
          width comes from the window-controls-overlay env() values, so it
          follows DPI scaling; without an overlay it resolves to 0. */}
        <div
          className="flex flex-row gap-4 items-center justify-between [-webkit-app-region:drag]"
          style={{
            paddingRight:
              'max(0px, calc(100vw - env(titlebar-area-x, 0px) - env(titlebar-area-width, 100vw)))',
          }}
        >
          <div className="flex flex-row gap-4 items-center">
            <GearIcon size={32} weight="bold" />
            <div>
              <div className="flex flex-row gap-6 items-baseline">
                <h1 className="text-2xl font-bold">Overlay Settings</h1>
                {simulatorName && (
                  <span className="text-lg font-medium text-slate-300">
                    {simulatorName}
                  </span>
                )}
              </div>
              {currentProfile && (
                <p className="text-sm text-slate-300">
                  {currentProfile.name} Profile
                </p>
              )}
            </div>
          </div>
          <div className="flex flex-row gap-2 [-webkit-app-region:no-drag]">
            <button
              onClick={toggleDemoMode}
              className="flex flex-row gap-1.5 items-center px-3 py-2 rounded skew-ui settings-heading font-semibold border border-slate-600 bg-slate-800 hover:border-accent-500 transition-colors"
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
              className="flex flex-row gap-1.5 items-center px-3 py-2 rounded skew-ui settings-heading font-semibold border border-slate-600 bg-slate-800 hover:border-accent-500 transition-colors"
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
          <div className="w-3/4 bg-slate-800 p-4 rounded-md border border-slate-600/60 flex flex-col overflow-hidden">
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
    </ReleaseNotesStatusProvider>
  );
};
