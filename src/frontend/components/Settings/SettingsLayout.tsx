import { Gear, Lock, LockOpen, PresentationChart } from '@phosphor-icons/react';
import { Link, Route, Routes, useLocation } from 'react-router-dom';
import { StandingsSettings } from './sections/StandingsSettings';
import { RelativeSettings } from './sections/RelativeSettings';
import { WeatherSettings } from './sections/WeatherSettings';
import { TrackMapSettings } from './sections/TrackMapSettings';
import { AdvancedSettings } from './sections/AdvancedSettings';
import { InputSettings } from './sections/InputSettings';
import { AboutSettings } from './sections/AboutSettings';
import { useDashboard } from '@irdashies/context';
import { useState } from 'react';

export const SettingsLayout = () => {
  const location = useLocation();
  const { bridge, editMode, isDemoMode, toggleDemoMode } = useDashboard();
  const [isLocked, setIsLocked] = useState(!editMode);

  const isActive = (path: string) => {
    return location.pathname === `/settings${path}`;
  };

  const menuItemClass = (path: string) =>
    `block w-full p-2 rounded cursor-pointer ${
      isActive(path) ? 'bg-slate-700' : 'hover:bg-slate-700'
    }`;

  const handleToggleLock = async () => {
    const locked = await bridge.toggleLockOverlays();
    setIsLocked(locked);
  };

  return (
    <div className="flex flex-col gap-4 bg-slate-700 p-4 rounded-md w-full h-full">
      <div className="flex flex-row gap-4 items-center justify-between">
        <div className="flex flex-row gap-4 items-center">
          <Gear size={32} weight="bold" />
          <h1 className="text-2xl font-bold">Overlay Setup</h1>
        </div>
        <div className="flex flex-row gap-2">
          <button
            onClick={toggleDemoMode}
            className="flex flex-row gap-2 items-center px-3 py-2 rounded bg-slate-800 hover:bg-slate-600 transition-colors"
          >
            {isDemoMode ? (
              <>
                <PresentationChart size={20} weight="bold" />
                <span>Exit Demo</span>
              </>
            ) : (
              <>
                <PresentationChart size={20} weight="bold" />
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
                <Lock size={20} weight="bold" />
                <span>Edit Layout</span>
              </>
            ) : (
              <>
                <LockOpen size={20} weight="bold" />
                <span>Editing Layout</span>
              </>
            )}
          </button>
        </div>
      </div>
      <div className="flex flex-row gap-4 flex-1 min-h-0">
        {/* Left Column - Widget Menu */}
        <div className="w-1/3 bg-slate-800 p-4 rounded-md flex flex-col overflow-y-auto">
          <ul className="flex flex-col gap-2 flex-1">
            <li>
              <Link to="/settings/input" className={menuItemClass('/input')}>
                Input Traces
              </Link>
            </li>
            <li>
              <Link
                to="/settings/standings"
                className={menuItemClass('/standings')}
              >
                Standings
              </Link>
            </li>
            <li>
              <Link
                to="/settings/relative"
                className={menuItemClass('/relative')}
              >
                Relative
              </Link>
            </li>
            <li>
              <Link
                to="/settings/weather"
                className={menuItemClass('/weather')}
              >
                Weather
              </Link>
            </li>
            <li>
              <Link to="/settings/map" className={menuItemClass('/track-map')}>
                <div className="flex flex-row gap-2 items-center">
                  Track Map
                  <span className="text-xs bg-yellow-600 text-yellow-100 px-2 py-0.5 rounded-full flex flex-row gap-1 items-center">
                    Experimental
                  </span>
                </div>
              </Link>
            </li>
          </ul>
          {/* Advanced settings pushed to bottom */}
          <div className="mt-auto pt-4 border-t border-slate-700 flex flex-col gap-2">
            <Link
              to="/settings/advanced"
              className={menuItemClass('/advanced')}
            >
              Advanced
            </Link>
            <Link
              to="/settings/about"
              className={menuItemClass('/about')}
            >
              About
            </Link>
          </div>
        </div>

        {/* Right Column - Widget Settings */}
        <div className="w-2/3 bg-slate-800 p-4 rounded-md flex flex-col overflow-hidden">
          <Routes>
            <Route path="standings" element={<StandingsSettings />} />
            <Route path="relative" element={<RelativeSettings />} />
            <Route path="weather" element={<WeatherSettings />} />
            <Route path="map" element={<TrackMapSettings />} />
            <Route path="input" element={<InputSettings />} />
            <Route path="advanced" element={<AdvancedSettings />} />
            <Route path="about" element={<AboutSettings />} />
            <Route
              path="*"
              element={
                <div className="text-slate-400">
                  Select a widget from the left to customize its settings
                </div>
              }
            />
          </Routes>
        </div>
      </div>
    </div>
  );
};
