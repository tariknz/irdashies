import {
  GearIcon,
  LockIcon,
  LockOpenIcon,
  PresentationChartIcon,
} from '@phosphor-icons/react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { useDashboard } from '@irdashies/context';
import { SettingsLoader } from './SettingsLoader';
import { SettingsMenu } from './SettingsMenu';
import { useState } from 'react';

export const SettingsLayout = () => {
  const {
    bridge,
    editMode,
    isDemoMode,
    toggleDemoMode,
    currentDashboard,
    currentProfile,
  } = useDashboard();
  const [isLocked, setIsLocked] = useState(!editMode);

  const handleToggleLock = async () => {
    const locked = await bridge.toggleLockOverlays();
    setIsLocked(locked);
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
              <p className="text-sm text-gray-400">
                {currentProfile.name} Active
              </p>
            )}
          </div>
        </div>
        <div className="flex flex-row gap-2">
          <button
            onClick={toggleDemoMode}
            className="flex flex-row gap-2 items-center px-3 py-2 rounded bg-slate-800 hover:bg-slate-600 transition-colors"
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
            className="flex flex-row gap-2 items-center px-3 py-2 rounded bg-slate-800 hover:bg-slate-600 transition-colors"
          >
            {isLocked ? (
              <>
                <LockIcon size={20} weight="bold" />
                <span>Edit Layout (F6)</span>
              </>
            ) : (
              <>
                <LockOpenIcon size={20} weight="bold" />
                <span>Editing Layout (F6)</span>
              </>
            )}
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
